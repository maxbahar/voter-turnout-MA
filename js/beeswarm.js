class Beeswarm {
    constructor(parentElement, data) {
        this.parentElement = parentElement;
        this.data = data

        this.initVis();
    }

    initVis() {
        let vis = this;

        // Define width, height, and margins
        vis.margin = {top: 10, right: 100, bottom: 10, left: 50};
        vis.width = document.getElementById(vis.parentElement).getBoundingClientRect().width - vis.margin.left - vis.margin.right;
        vis.height = document.getElementById(vis.parentElement).getBoundingClientRect().height - vis.margin.top - vis.margin.bottom;

        // Initialize SVG drawing area
        vis.svg = d3.select("#" + vis.parentElement).append("svg")
            .attr("width", vis.width + vis.margin.left + vis.margin.right)
            .attr("height", vis.height + vis.margin.top + vis.margin.bottom)
            .append("g")
            .attr("transform", "translate(" + vis.margin.left + "," + vis.margin.top + ")");

        vis.wrangleData()
    }

    wrangleData() {
        let vis = this;

        vis.min = 0
        vis.max = 0

        vis.key_list = []

        Object.keys(vis.data).forEach((key) => {
            vis.min_max_range = d3.extent(vis.data[key].map((d) => +d[0]))
            vis.absoluteValues = vis.data[key].map((d) => Math.abs(+d[0]))
            vis.key_list.push([key, d3.mean(vis.absoluteValues)])

            if(vis.min_max_range[0] < vis.min){
                vis.min = vis.min_max_range[0]
            }
            if(vis.min_max_range[1] > vis.max){
                vis.max = vis.min_max_range[1]
            }
        });

        vis.sortedByAbsMeanDescending = vis.key_list.sort((a, b) => d3.ascending(a[1], b[1]));

        vis.sortedKeys = []

        vis.sortedByAbsMeanDescending.forEach((d) => {
            vis.sortedKeys.push(d[0])
        })

        //limit to top 8 features to fit within content card

        vis.xScale = d3
            .scaleLinear()
            .domain([vis.min-0.01, vis.max+0.01])
            .range([150, vis.width]);

        vis.yScale = d3
            .scaleBand()
            .domain(vis.sortedKeys)
            .range([vis.height-20, 20])

        vis.xAxis = d3.axisBottom(vis.xScale);


        vis.sortedKeys.forEach((key) => {
            vis.colorScale = d3.scaleLinear()
                .domain(d3.extent(vis.data[key].map((d) => +d[1])))
                .range(["blue", "red"]); // Choose your color range

            vis.offset_flag = true

            vis.svg.selectAll("circle")
                .data(vis.data[key], d => d.id)
                .enter()
                .append("circle")
                .attr("id", (d, i) => "circle-" + i)
                .attr("class", key)
                .attr("cx", d => vis.xScale(d[0]))
                .attr("cy", ((d, i) => {
                    let x = vis.xScale(d[0])
                    let y = vis.yScale(key)
                    let yOffset = 0
                    // Check for overlap with previous elements
                    for (let j = 0; j < i; j++) {
                        let prevX = vis.xScale(vis.data[key][j][0]);
                        if (Math.abs(x - prevX) < 1) {
                            if (vis.offset_flag){
                                yOffset -= 0.05; // Shift up
                            }
                            else{
                                yOffset += 0.05; // Shift down
                            }
                        }
                        if(yOffset <=-15 || yOffset >=15){
                            j = i;
                        }
                    }
                    vis.offset_flag = !vis.offset_flag
                    if (yOffset < -15){
                        yOffset = -15; // Max up shift
                    }
                    if (yOffset > 15){
                        yOffset = 15; // Max down shift
                    }
                    return y + yOffset;
                }))
                .attr("fill", d => vis.colorScale(d[1]))
                .attr("r", 3);

            vis.svg.append("text")
                .attr("class", "key-label")
                .attr("x", 130)
                .attr("y", vis.yScale(key))
                .attr("text-anchor", "end")
                .text(variableMap[key+"_shap"]);
        });


        vis.svg.append("g")
            .attr("transform", `translate(0, ${vis.height - 50})`) // Position the axis at the bottom
            .call(vis.xAxis);

        // Add the x-axis label
        vis.svg.append("text")
            .attr("class", "x-axis-label")
            .attr("x", vis.width / 2)
            .attr("y", vis.height - 10)
            .attr("text-anchor", "middle")
            .text("SHAP value (impact on model output)");

        vis.svg.append("line")
            .attr("x1", vis.xScale(0))
            .attr("y1", vis.margin.top) // Top of the plot
            .attr("x2", vis.xScale(0))
            .attr("y2", vis.height-50) // Bottom of the plot
            .attr("stroke", "grey"); // Style the line as needed

        vis.colorScale2 = d3.scaleLinear()
            .domain([0, 100]) // Adjust to your data range
            .range(["red", "blue"]); // Choose your color range

        vis.legend = vis.svg.append("g")
            .attr("class", "legend")
            .attr("transform", `translate(${vis.width + 20}, ${vis.margin.top})`); // Position the legend

        vis.legendHeight = vis.height-120; // Adjust to your preference

        vis.legendGradient = vis.legend.append("defs")
            .append("linearGradient")
            .attr("id", "legend-gradient")
            .attr("x1", "0%")
            .attr("y1", "0%")
            .attr("x2", "0%")
            .attr("y2", "100%");

        vis.legendGradient.append("stop")
            .attr("offset", "0%")
            .attr("stop-color", vis.colorScale2.range()[0]);

        vis.legendGradient.append("stop")
            .attr("offset", "100%")
            .attr("stop-color", vis.colorScale2.range()[1]);

        vis.legend.append("rect")
            .attr("width", 10)
            .attr("height", vis.legendHeight)
            .style("fill", "url(#legend-gradient)");

        // Add the y-axis label
        vis.svg.append("text")
            .attr("class", "y-axis-label")
            .attr("transform", "rotate(-90)")
            .attr("x", -vis.height/2)
            .attr("y", vis.width + 60)
            .attr("text-anchor", "middle")
            .text("Feature value");

        vis.svg.append("text")
            .attr("x", vis.width + 35)
            .attr("y", vis.margin.top + 5)
            .attr("text-anchor", "start")
            .text("High");

        vis.svg.append("text")
            .attr("x", vis.width + 35)
            .attr("y", vis.height-65)
            .attr("text-anchor", "start")
            .text("Low");
    }
}