import zipfile
import pandas as pd
import geopandas as gpd
import numpy as np

from sklearn.model_selection import KFold
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LinearRegression

# Group demographic columns together
registered = ["total_reg"]
age = ["age_18_19", "age_20_24", "age_25_29","age_30_34","age_35_44", "age_45_54", "age_55_64", "age_65_74","age_75_84", "age_85over"]
init_gender = [ "voters_gender_m", "voters_gender_f", "voters_gender_unknown"] 
gender = [ "gender_m", "gender_f", "gender_unknown"] 
party = ["party_npp", "party_dem", "party_rep","party_lib", "party_grn", "party_con", "party_ain", "party_scl","party_oth"]
ethnicity1 = ["eth1_eur", "eth1_hisp", "eth1_aa",
                "eth1_esa", "eth1_oth", "eth1_unk"]
init_languages = ["languages_description_english", "languages_description_spanish",
                "languages_description_portuguese",
                "languages_description_chinese", "languages_description_italian",
                "languages_description_vietnamese", "languages_description_other",
                "languages_description_unknown"]
languages = ["lang_english", "lang_spanish",
                "lang_portuguese",
                "lang_chinese", "lang_italian",
                "lang_vietnamese", "lang_other",
                "lang_unknown"]
income = ["commercialdata_estimatedhhincomeamount_avg"]
predictors = [*registered, *age, *gender, *party, *ethnicity1, *languages, "mean_hh_income"]

def process_data(csv_zipfile="../data/MA_l2_2022stats_2020block.zip",
                 bg_zipfile="../data/ma_pl2020_bg.zip",
                 t_zipfile="../data/ma_pl2020_t.zip",
                 c_zipfile="../data/ma_pl2020_cnty.zip"):
    
    with zipfile.ZipFile(csv_zipfile) as z:
        with z.open("MA_l2_2022stats_2020block.csv") as f:
            voter_blocks_all = pd.read_csv(f, low_memory=False).set_index("geoid20")
    
    block_groups_shp = gpd.read_file(f"zip://{bg_zipfile}!ma_pl2020_bg.shp")
    tracts_shp = gpd.read_file(f"zip://{t_zipfile}!ma_pl2020_t.shp")
    counties_shp = gpd.read_file(f"zip://{c_zipfile}!ma_pl2020_cnty.shp")

    # Rename columns for easier intepretation
    col_labels = {k:v for k, v in zip(init_gender, gender)}
    col_labels.update({k:v for k,v in zip(init_languages, languages)})
    voter_blocks_all = voter_blocks_all.rename(col_labels, axis=1)

    # Drop "NO BLOCK ASSIGNMENT" entries
    voter_blocks = voter_blocks_all[~voter_blocks_all.index.str.contains("NO BLOCK ASSIGNMENT")].copy()

    # Drop Census Blocks with zero voters registered during the 2020 presidential election or ever
    voter_blocks = voter_blocks[voter_blocks["g20201103_reg_all"] > 0]
    voter_blocks = voter_blocks[voter_blocks["total_reg"] > 0]

    # Weighted mean function based on total registered voters
    wm_blocks = lambda x: (
        np.average(x.dropna(), weights=voter_blocks.loc[x.dropna().index, "total_reg"])
        if voter_blocks.loc[x.dropna().index, "total_reg"].sum() > 0
        else np.nan
    )

    # Define aggregation method for columns
    agg_funcs = {col: "sum" for col in [*registered, *age, *gender, *party, *ethnicity1, *languages, "g20201103_voted_all", "g20201103_reg_all"]}
    agg_funcs.update({"commercialdata_estimatedhhincomeamount_avg": wm_blocks})

    # Define block group ID
    voter_blocks["block_group_id"] = voter_blocks.index.str[:12]
    block_groups = voter_blocks.groupby("block_group_id").agg(agg_funcs)

    # Rename the income column
    block_groups = block_groups.rename({"commercialdata_estimatedhhincomeamount_avg":"mean_hh_income"}, axis=1)

    # Choose to drop NaN values for income due to low number of voters in these blocks.
    block_groups = block_groups.dropna(subset="mean_hh_income")

    # Only keep columns of interest
    block_groups["2020_turnout_pct"] = block_groups["g20201103_voted_all"] / block_groups["g20201103_reg_all"]

    # Weighted mean function based on total registered voters
    wm_bg = lambda x: (
        np.average(x.dropna(), weights=block_groups.loc[x.dropna().index, "total_reg"])
        if block_groups.loc[x.dropna().index, "total_reg"].sum() > 0
        else np.nan
    )

    # Define aggregation method for columns
    agg_funcs = {col: "sum" for col in [*registered, *age, *gender, *party, *ethnicity1, *languages, "g20201103_voted_all", "g20201103_reg_all"]}
    agg_funcs.update({"mean_hh_income": wm_bg})

    # Define tract and county IDs
    block_groups["tract_id"] = block_groups.index.str[:11]
    block_groups["county_id"] = block_groups.index.str[:5]

    # Aggregate
    tracts = block_groups.groupby("tract_id").agg(agg_funcs)
    counties = block_groups.groupby("county_id").agg(agg_funcs)

    # Take proportions
    for cat in [*age, *gender, *party, *ethnicity1, *languages]:
        block_groups[cat] = block_groups[cat] / block_groups["total_reg"]
        tracts[cat] = tracts[cat] / tracts["total_reg"]
        counties[cat] = counties[cat] / counties["total_reg"]

    # Join to shapefiles
    bg_gdf = block_groups_shp.merge(block_groups, left_on="GEOID20", right_on="block_group_id").set_index("GEOID20")
    t_gdf = tracts_shp.merge(tracts, left_on="GEOID20", right_on="tract_id").set_index("GEOID20")
    c_gdf = counties_shp.merge(counties, left_on="GEOID20", right_on="county_id").set_index("GEOID20")
    
    # Keep only relevant columns
    keep_cols = predictors + ["g20201103_voted_all","g20201103_reg_all","BASENAME", "ALAND20", "geometry"]
    bg_gdf = bg_gdf[keep_cols]
    t_gdf = t_gdf[keep_cols]
    c_gdf = c_gdf[keep_cols]

    data_dict = {"block_group":bg_gdf, "tract":t_gdf, "county":c_gdf}

    # Change variable names and calculate turnout percentage
    for name,gdf in data_dict.items():
        gdf = gdf.rename({"g20201103_voted_all": "2020_turnout", "g20201103_reg_all": "2020_registered"}, axis=1)
        gdf["2020_turnout_pct"] = gdf["2020_turnout"] / gdf["2020_registered"]
        gdf["2020_absent_pct"] = 1 - gdf["2020_turnout_pct"]
        data_dict[name] = gdf

    return data_dict

def generate_predictions(data_dict, random_state=None):
    bg_data = data_dict["block_group"]
    t_data = data_dict["tract"]
    c_data = data_dict["county"]

    X = bg_data[predictors]
    y = bg_data["2020_turnout_pct"]

    bg_predictions = bg_data[["2020_turnout_pct","2020_absent_pct","2020_registered","2020_turnout"]].copy()

    kf = KFold(n_splits=10,shuffle=True,random_state=random_state)
    X.loc[:,["total_reg","mean_hh_income"]] = StandardScaler().fit_transform(X=X[["total_reg","mean_hh_income"]])

    linreg = LinearRegression()

    for train_idx, val_idx in kf.split(X, y):
        train = X.index[train_idx]
        val = X.index[val_idx]
        linreg.fit(X.loc[train], y.loc[train])
        bg_predictions.loc[val,"2020_turnout_pct_pred"] = linreg.predict(X.loc[val])

    # Calculate other columns
    bg_predictions["2020_absent"] = bg_predictions["2020_registered"] - bg_predictions["2020_turnout"]
    bg_predictions["2020_absent_pct_pred"] = 1 - bg_predictions["2020_turnout_pct_pred"]
    bg_predictions["2020_turnout_pred"] = (bg_predictions["2020_registered"] * bg_predictions["2020_turnout_pct_pred"]).round(decimals=0).astype(int)
    bg_predictions["2020_absent_pred"] = bg_predictions["2020_registered"] - bg_predictions["2020_turnout_pred"] 

    # Aggregate to Tract
    t_predictions = bg_predictions.copy()
    t_predictions["tract_id"] = bg_predictions.index.str[:11]
    t_predictions = t_predictions.groupby("tract_id")[["2020_registered", "2020_turnout", "2020_absent", "2020_turnout_pred", "2020_absent_pred"]].sum()
    t_predictions["2020_turnout_pct_pred"] = t_predictions["2020_turnout_pred"] / t_predictions["2020_registered"]
    t_predictions["2020_absent_pct_pred"] = 1 - t_predictions["2020_turnout_pct_pred"]

    # Aggregate to County
    c_predictions = bg_predictions.copy()
    c_predictions["county_id"] = bg_predictions.index.str[:5]
    c_predictions = c_predictions.groupby("county_id")[["2020_registered", "2020_turnout", "2020_absent", "2020_turnout_pred", "2020_absent_pred"]].sum()
    c_predictions["2020_turnout_pct_pred"] = c_predictions["2020_turnout_pred"] / c_predictions["2020_registered"]
    c_predictions["2020_absent_pct_pred"] = 1 - c_predictions["2020_turnout_pct_pred"]

    bg_joined = bg_data.merge(bg_predictions.drop(columns=["2020_registered","2020_turnout","2020_turnout_pct","2020_absent_pct"]), left_on="GEOID20", right_on="GEOID20")
    t_joined = t_data.merge(t_predictions.drop(columns=["2020_registered","2020_turnout"]), left_index=True, right_on="tract_id").reset_index().rename({"tract_id":"GEOID20"}, axis=1).set_index("GEOID20")
    c_joined = c_data.merge(c_predictions.drop(columns=["2020_registered","2020_turnout"]), left_index=True, right_on="county_id").reset_index().rename({"county_id":"GEOID20"}, axis=1).set_index("GEOID20")

    return {"block_group":bg_joined, "tract":t_joined, "county":c_joined}

if __name__ == "__main__":

    data_dict = process_data()
    data_dict["block_group"].to_file("../data/block_groups.geojson")
    data_dict["tract"].to_file("../data/tracts.geojson")
    data_dict["county"].to_file("../data/counties.geojson")

    pred_dict = generate_predictions(data_dict, random_state=209)
    pred_dict["block_group"].to_file("../data/block_groups_pred.geojson")
    pred_dict["tract"].to_file("../data/tracts_pred.geojson")
    pred_dict["county"].to_file("../data/counties_pred.geojson")