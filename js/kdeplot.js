class KdePlot {

    constructor(parentElement, data) {
        this.parentElement = parentElement;
        this.data = data;
        this.margin = {top: 20, right: 20, bottom: 20, left: 20};
        this.selectedCategory = "gender"
        this.initVis();
        window.addEventListener('resize', () => this.resize());


    }

    resize() {
        let vis = this;
        vis.width = document.getElementById(vis.parentElement).getBoundingClientRect().width - vis.margin.left - vis.margin.right;
        vis.height = document.getElementById(vis.parentElement).getBoundingClientRect().height - vis.margin.top - vis.margin.bottom;

        vis.svg.attr("width", vis.width + vis.margin.left + vis.margin.right)
            .attr("height", vis.height + vis.margin.top + vis.margin.bottom)

        this.svg.select('rect')
            .attr('width', this.width)
            .attr('height', this.height);
    }


    initVis() {
        let vis = this;

        let defaultTag = vis.selectedCategory

        // trace init
        vis.traceOptions = {
            "gender": [{xKey: 'x_male', color: "#4C90F0", label: 'Male'}, {
                xKey: 'x_female',
                color: "#D33D17",
                label: "Female"
            }],
            "party": [{xKey: 'x_party_rep', color: "#D33D17", label: 'Republican'}, {
                xKey: 'x_party_dem',
                color: "#2D72D2",
                label: "Democrat"
            }, {xKey: 'x_party_np', color: "#32A467", label: 'Non-Partisan'},],
            "ethnicity": [{xKey: 'x_eth_eur', color: "#3FA6DA", label: "European"}, {
                xKey: 'x_eth_esa',
                color: "#62D96B",
                label: "East and South Asian"
            }, {xKey: 'x_eth_hisp', color: "#F0B726", label: "Hispanic and Portuguese"}, {
                xKey: 'x_eth_aa',
                color: "#D33D17",
                label: "African-American"
            }],
            "age": [{xKey: 'x_age_young1', color: "#D33D17", label: "Ages 18-24"}, {
                xKey: 'x_age_young2',
                color: "#147EB3",
                label: "Ages 25-34"
            }, {xKey: 'x_age_mid', color: "#F0B726", label: "Ages 35-64"}, {
                xKey: 'x_age_old',
                color: "#43BF4D",
                label: "Ages 65-85+"
            }],
            "language": [{xKey: 'x_lang_eng', color: "#3FA6DA", label: "English"}, {
                xKey: 'x_lang_chin',
                color: "#D33D17",
                label: "Chinese and Vietnamese"
            }, {xKey: 'x_lang_ital', color: "#62D96B", label: "Italian"}, {
                xKey: 'x_lang_span',
                color: "#F0B726",
                label: "Spanish and Portuguese"
            },
                {
                    xKey: 'x_lang_unknown',
                    color: "#9D3F9D",
                    label: "Unknown"
                }],

        }

        vis.traceConfigs = {
            "gender": {xDomain: [.4, .6], yDomain: [.5, 1]},
            "party": {xDomain: [-.05, .75], yDomain: [0.4, 1]},
            "ethnicity": {xDomain: [-.1, .95], yDomain: [0.5, 1]},
            "age": {xDomain: [0, .6], yDomain: [0.4, 1]},
            "language": {xDomain: [-0.05, .75], yDomain: [0.5, 1]},
        }
        vis.activeTraces = vis.traceOptions[defaultTag]
        vis.xDomain = vis.traceConfigs[defaultTag].xDomain;
        vis.yDomain = vis.traceConfigs[defaultTag].yDomain;


        // svg basics init
        vis.width = document.getElementById(vis.parentElement).getBoundingClientRect().width - vis.margin.left - vis.margin.right;
        vis.height = document.getElementById(vis.parentElement).getBoundingClientRect().height - vis.margin.top - vis.margin.bottom;

        vis.svg = d3.select("#" + vis.parentElement).append("svg")
            .attr("width", vis.width + vis.margin.left + vis.margin.right)
            .attr("height", vis.height + vis.margin.top + vis.margin.bottom)
            .attr("style", "max-width: 100%; height: auto;")
            .append("g")
            .attr("transform", "translate(" + vis.margin.left + "," + vis.margin.top + ")");

        vis.svg.append('rect')
            .attr('width', vis.width)
            .attr('height', vis.height)
            .attr('fill', '#fff');
        // scale init
        vis.xScale = d3.scaleLinear()
            .domain(vis.xDomain)
            .rangeRound([vis.margin.left, vis.width - vis.margin.right]);

        vis.yScale = d3.scaleLinear()
            .domain(vis.yDomain)
            .rangeRound([vis.height - vis.margin.bottom, vis.margin.top]);

        let tooltip = d3.select(".kde-tooltip")
            .style('position', 'absolute')
            .style('color', 'black')
            .style('visibility', 'hidden');

        let horizontalLine = vis.svg.append('line')
            .attr('stroke', '#000')
            .attr('stroke-width', 1)
            .attr('stroke-dasharray', '4')
            .style('opacity', 0);

        let verticalLine = vis.svg.append('line')
            .attr('stroke', '#000')
            .attr('stroke-width', 1)
            .attr('stroke-dasharray', '4')
            .style('opacity', 0);

        vis.svg.on('mousemove', function (event) {
            let mousePosition = d3.pointer(event);

            horizontalLine
                .attr('x1', 0)
                .attr('y1', mousePosition[1])
                .attr('x2', vis.width)
                .attr('y2', mousePosition[1])
                .style('opacity', 1);

            verticalLine
                .attr('x1', mousePosition[0])
                .attr('y1', 0)
                .attr('x2', mousePosition[0])
                .attr('y2', vis.height)
                .style('opacity', 1);
        });

        vis.svg.on('mouseout', function () {
            tooltip.style('visibility', 'hidden');
            horizontalLine.style('opacity', 0);
            verticalLine.style('opacity', 0);
        });

        // build data for plots

        let nData = []

        vis.data.features.forEach(function (feature) {
            nData.push({
                x_female: feature.properties.gender_f,
                x_male: feature.properties.gender_m,
                x_party_np: feature.properties.party_npp,
                x_party_dem: feature.properties.party_dem,
                x_party_rep: feature.properties.party_rep,
                x_eth_aa: feature.properties.eth1_aa,
                x_eth_esa: feature.properties.eth1_esa,
                x_eth_eur: feature.properties.eth1_eur,
                x_eth_hisp: feature.properties.eth1_hisp,
                x_eth_oth: feature.properties.eth1_oth,
                x_age_young1: (feature.properties.age_18_19 + feature.properties.age_20_24),
                x_age_young2: (feature.properties.age_25_29 + feature.properties.age_30_34),
                x_age_mid: (+feature.properties.age_35_44 + feature.properties.age_45_54 + feature.properties.age_55_64),
                x_age_old: (feature.properties.age_65_74 + feature.properties.age_75_84 + feature.properties.age_85over),
                x_lang_chin: (feature.properties.lang_chinese + feature.properties.lang_vietnamese),
                x_lang_eng: feature.properties.lang_english,
                x_lang_ital: feature.properties.lang_italian,
                x_lang_span: (feature.properties.lang_portuguese + feature.properties.lang_spanish),
                x_lang_unknown: (feature.properties.lang_unknown),
                y: feature.properties["2020_turnout_pct"]

            });

        });


        vis.builtData = nData


        vis.svg.append("g")
            .attr("class", 'x-axis')
            .attr("transform", `translate(0,${vis.height - vis.margin.bottom})`)
            .call(d3.axisBottom(vis.xScale).tickSizeOuter(0))
            .call(g => g.select(".tick:last-of-type text").clone()
                .attr("y", -3)
                .attr("dy", null)
                .attr("font-weight", "bold")
                .text("ratio of group"));

        vis.svg.append("g")
            .attr("class", 'y-axis')
            .attr("transform", `translate(${vis.margin.left},0)`)
            .call(d3.axisLeft(vis.yScale).tickSizeOuter(0))
            .call(g => g.select(".tick:last-of-type text").clone()
                .attr("x", 3)
                .attr("text-anchor", "start")
                .attr("font-weight", "bold")
                .text("voter turnout"));


        vis.wrangleData()
    }


    updateVis() {
        let vis = this;
        // update axes
        vis.svg.select(".x-axis")
            .transition()
            .duration(750)
            .call(d3.axisBottom(vis.xScale));

        vis.svg.select(".y-axis")
            .transition()
            .duration(750)
            .call(d3.axisLeft(vis.yScale));

        // update legend
        for (let i = 0; i < 5; i++) {
            document.getElementById("k-t-r" + i + "-color").style.background = "white"
            document.getElementById("k-t-r" + i + "-label").innerText = ""
        }
        vis.activeTraces.forEach((d, i) => {
            document.getElementById("k-t-r" + i + "-color").style.background = d.color
            document.getElementById("k-t-r" + i + "-label").innerText = d.label
        })

        // contours
        let contours = []

        vis.activeTraces.forEach((trace) => {
            contours.push(d3.contourDensity()
                .x(d => vis.xScale(d[trace.xKey]))
                .y(d => vis.yScale(d.y))
                .size([vis.width, vis.height])
                .bandwidth(10)
                .thresholds(15)
                (vis.builtData))
        })

        vis.svg.selectAll(".kde-cont")
            .transition()
            .duration(1000)
            .style("opacity", 0)
            .on("end", function () {
                d3.select(this).remove();
            });

        contours.forEach((contour, i) => {
            vis.svg.append("g")
                .attr("class", "kde-cont")
                .attr("fill", "none")
                .attr("stroke", vis.activeTraces[i].color)
                .attr("stroke-linejoin", "round")
                .selectAll()
                .data(contour)
                .join("path")
                .attr("d", d3.geoPath())
                .style("opacity", 0)
                .transition()
                .duration(1000)
                .style("opacity", 1);
        });

    }

    wrangleData() {
        let vis = this;

        // set up data
        vis.activeTraces = vis.traceOptions[vis.selectedCategory]
        // reset x and y domains
        vis.xScale.domain(vis.traceConfigs[vis.selectedCategory].xDomain);
        vis.yScale.domain(vis.traceConfigs[vis.selectedCategory].yDomain);

        vis.updateVis()

    }

    selectionChange(key) {
        let vis = this;

        vis.selectedCategory = key

        vis.wrangleData()

    }


}