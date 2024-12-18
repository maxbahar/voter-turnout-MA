class BarVis {

    constructor(parentElement, geoData, category) {
        
        this.parentElement = parentElement;
        this.geoData = geoData;
        this.category = category;

        this.initVis();
        
    }

    initVis() {

        let vis = this;
        
        vis.margin = {top: 20, right: 20, bottom: 70, left: 50};
        vis.width = document.getElementById(vis.parentElement).getBoundingClientRect().width - vis.margin.left - vis.margin.right;
        vis.height = document.getElementById(vis.parentElement).getBoundingClientRect().height - vis.margin.top - vis.margin.bottom;

        // Initialize SVG drawing area 
        vis.svg = d3.select("#" + vis.parentElement).append("svg")
                    .attr("width", vis.width + vis.margin.left + vis.margin.right)
                    .attr("height", vis.height + vis.margin.top + vis.margin.bottom)
                    .append("g")
                    .attr("transform", "translate(" + vis.margin.left + "," + vis.margin.top + ")");
        

        // Initialize scale
        vis.y = d3.scaleLinear()
                    .range([vis.height, 0]);

        vis.x = d3.scaleBand()
                    .range([0,vis.width])
                    .paddingInner(0.15)
                    .paddingOuter(0.15);
        
		vis.xAxis = d3.axisBottom()
                        .scale(vis.x);

        vis.yAxis = d3.axisLeft()
                        .scale(vis.y)
                        .ticks(4)
                        .tickFormat(d3.format(".0%"));

        // Initialize axis
        vis.xAxisGroup = vis.svg.append("g")
                                .attr("class","x-axis")
                                .attr("transform", `translate(0, ${vis.height})`);;

        vis.yAxisGroup = vis.svg.append("g")
                                .attr("class","y-axis");


        vis.wrangleData();

    }

    wrangleData() {
        let vis = this;


        // Define the category
        // If income, calculate histogram
        if (vis.category == "vote-income") {
            vis.variables = ["mean_hh_income"];

            let bgArray = vis.geoData["blockGroup"].features
                                .filter(d => d.properties["GEOID20"].slice(0,5) == chosenFeature.properties["GEOID20"])
                                .map((d) => [d.properties["mean_hh_income"], d.properties["total_reg"]]);

            // Create histogram
            let binSize = 10000;
            let incomeMin = Math.floor(d3.min(bgArray.map(d => d[0])) / binSize) * binSize;
            let incomeMax = Math.ceil(d3.max(bgArray.map(d => d[0])) / binSize) * binSize;
            let numBins = Math.ceil((incomeMax - incomeMin) / binSize);
            vis.displayData = Array.from({length: numBins}, (_, i) => [ `$${(incomeMin + (i + 1) * binSize) / 1000},000`, 0 ]);
            let totalCount = d3.sum(bgArray, d => d[1]);

            bgArray.forEach(d => {
                let binIndex
                if (d[0] === incomeMax) {
                    binIndex = numBins - 1;
                } else {
                    binIndex = Math.floor((d[0] - incomeMin) / binSize);
                }
                vis.displayData[binIndex][1] += d[1];
            });

            vis.displayData.forEach(bin => {
                bin[1] /= totalCount;  // Convert to proportion
            });

        // If other variable, use proportions
        } else {
            switch(vis.category) {
                case "vote-party":
                    vis.variables = ['party_npp', 'party_dem', 'party_rep','party_lib', 'party_grn', 'party_con', 'party_ain', 'party_scl','party_oth']
                    break;
                case "vote-gender":
                    vis.variables = ['gender_m', 'gender_f', 'gender_unknown'] 
                    break;
                case "vote-age":
                    vis.variables = ['age_18_19', 'age_20_24', 'age_25_29','age_30_34','age_35_44', 'age_45_54', 'age_55_64', 'age_65_74','age_75_84', 'age_85over']
                    break;
                case "vote-lang":
                    vis.variables = ['lang_english', 'lang_spanish', 'lang_portuguese', 'lang_chinese', 'lang_italian', 'lang_vietnamese', 'lang_other', 'lang_unknown']
                    break;
                case "vote-eth":
                    vis.variables = ['eth1_eur', 'eth1_hisp', 'eth1_aa', 'eth1_esa', 'eth1_oth', 'eth1_unk']
                    break;
            }

            // Get data for relevant variables
            vis.displayData = vis.variables.map((d) => [variableMap[d],chosenFeature.properties[d]]);

        }

        vis.updateVis();
    }

    updateVis() {
        let vis = this;

        // Update domains
        vis.x.domain(vis.displayData.map(d => d[0]));
        vis.y.domain([0, d3.max(vis.displayData.map(d => d[1]))]);

        // Draw bars
        vis.bars = vis.svg.selectAll(`.${vis.category}-bar`)
                        .data(vis.displayData, (d) => d[0]);

        vis.bars.exit().remove();

        vis.barsEnter = vis.bars.enter().append("rect")
                                .attr("class",`${vis.category}-bar`)
                                .attr("x",d => vis.x(d[0]))
                                .attr("y",d => vis.y(d[1]))
                                .attr("height",d => vis.height - vis.y(d[1]))
                                .attr("width", vis.x.bandwidth());

        vis.bars = vis.barsEnter.merge(vis.bars);

        vis.bars.transition().duration(800).attr("x",d => vis.x(d[0]))
                .attr("y",d => vis.y(d[1]))
                .attr("height",d => vis.height - vis.y(d[1]))
                .attr("width", vis.x.bandwidth());

        // Update axis
        vis.xAxisGroup.transition().duration(800).call(vis.xAxis).selectAll("text").attr("transform","rotate(-45)").style("text-anchor","end");
        vis.yAxisGroup.transition().duration(800).call(vis.yAxis);

    }
}