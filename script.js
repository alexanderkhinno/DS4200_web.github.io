// Dimensions
const margin = { top: 40, right: 30, bottom: 80, left: 80 };
const width = 960 - margin.left - margin.right;
const height = 500 - margin.top - margin.bottom;

// Append the SVG object to the body of the page
const svg = d3.select("#my_dataviz")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

// Create tooltip div
const tooltip = d3.select("body")
    .append("div")
    .style("opacity", 0)
    .attr("class", "tooltip")
    .style("background-color", "rgba(0, 0, 0, 0.8)")
    .style("color", "white")
    .style("padding", "10px")
    .style("border-radius", "5px")
    .style("position", "absolute")
    .style("pointer-events", "none")
    .style("font-size", "12px")
    .style("z-index", "1000");

// Create info panel for selected box
const infoPanel = d3.select("#my_dataviz")
    .append("div")
    .attr("class", "info-panel")
    .style("position", "absolute")
    .style("top", "10px")
    .style("right", "10px")
    .style("background-color", "rgba(255, 255, 255, 0.95)")
    .style("padding", "15px")
    .style("border-radius", "8px")
    .style("box-shadow", "0 2px 8px rgba(0,0,0,0.2)")
    .style("display", "none")
    .style("max-width", "250px")
    .style("font-size", "12px")
    .style("color", "#333");

// State management
let boxPlotData = [];
let validData = [];
let selectedClassification = null;
let showStripPlot = false;
let animationDuration = 1000;

// Helper function to calculate quartiles
function quartiles(sortedArray) {
    const q1Index = Math.floor(sortedArray.length * 0.25);
    const q2Index = Math.floor(sortedArray.length * 0.5);
    const q3Index = Math.floor(sortedArray.length * 0.75);
    
    return {
        q1: sortedArray[q1Index],
        median: sortedArray[q2Index],
        q3: sortedArray[q3Index],
        min: sortedArray[0],
        max: sortedArray[sortedArray.length - 1]
    };
}

// Helper function to calculate IQR and identify outliers
function calculateBoxPlotStats(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const stats = quartiles(sorted);
    const iqr = stats.q3 - stats.q1;
    const lowerFence = stats.q1 - 1.5 * iqr;
    const upperFence = stats.q3 + 1.5 * iqr;
    
    // Identify outliers
    const outliers = sorted.filter(v => v < lowerFence || v > upperFence);
    
    // Whiskers extend to the most extreme non-outlier values
    const whiskerLower = sorted.find(v => v >= lowerFence) || stats.min;
    const whiskerUpper = sorted.reverse().find(v => v <= upperFence) || stats.max;
    
    return {
        ...stats,
        iqr: iqr,
        lowerFence: lowerFence,
        upperFence: upperFence,
        outliers: outliers,
        whiskerLower: whiskerLower,
        whiskerUpper: whiskerUpper
    };
}

// Function to draw box plots
function drawBoxPlots(data, highlightClassification = null) {
    // Clear previous box plots
    svg.selectAll(".box-plot-group").remove();
    svg.selectAll(".strip-plot-group").remove();

    // Color scale based on classification
    const classificationOrder = ["Extreme Fear", "Fear", "Neutral", "Greed", "Extreme Greed"];
    const colorScale = d3.scaleOrdinal()
        .domain(classificationOrder)
        .range(["#8B0000", "#FF6B6B", "#FFD93D", "#6BCF7F", "#00A86B"]);

    // X scale for classification categories
    const x = d3.scaleBand()
        .domain(data.map(d => d.classification))
        .range([0, width])
        .padding(0.3);

    // Y scale for values (0-100)
    const y = d3.scaleLinear()
        .domain([0, 100])
        .nice()
        .range([height, 0]);

    // Draw box plots
    const boxWidth = x.bandwidth() * 0.7;

    data.forEach((d, i) => {
        const xPos = x(d.classification) + x.bandwidth() / 2;
        const color = colorScale(d.classification);
        const isHighlighted = highlightClassification === d.classification;
        const isDimmed = highlightClassification && !isHighlighted;
        const opacity = isDimmed ? 0.2 : (isHighlighted ? 1 : 0.8);

        // Create a group for each box plot
        const boxGroup = svg.append("g")
            .attr("class", "box-plot-group")
            .attr("data-classification", d.classification);

        // Draw whiskers with animation
        const whisker = boxGroup.append("line")
            .attr("x1", xPos)
            .attr("x2", xPos)
            .attr("y1", height)
            .attr("y2", height)
            .attr("stroke", "#333")
            .attr("stroke-width", 2)
            .attr("opacity", opacity)
            .transition()
            .duration(animationDuration)
            .delay(i * 100)
            .attr("y1", y(d.whiskerLower))
            .attr("y2", y(d.whiskerUpper));

        // Draw lower whisker cap
        boxGroup.append("line")
            .attr("x1", xPos - boxWidth / 2)
            .attr("x2", xPos + boxWidth / 2)
            .attr("y1", y(d.whiskerLower))
            .attr("y2", y(d.whiskerLower))
            .attr("stroke", "#333")
            .attr("stroke-width", 2)
            .attr("opacity", opacity);

        // Draw upper whisker cap
        boxGroup.append("line")
            .attr("x1", xPos - boxWidth / 2)
            .attr("x2", xPos + boxWidth / 2)
            .attr("y1", y(d.whiskerUpper))
            .attr("y2", y(d.whiskerUpper))
            .attr("stroke", "#333")
            .attr("stroke-width", 2)
            .attr("opacity", opacity);

        // Draw box (Q1 to Q3) with animation
        const box = boxGroup.append("rect")
            .attr("x", xPos - boxWidth / 2)
            .attr("y", height)
            .attr("width", boxWidth)
            .attr("height", 0)
            .attr("fill", color)
            .attr("stroke", "#333")
            .attr("stroke-width", isHighlighted ? 3 : 2)
            .attr("opacity", opacity)
            .attr("cursor", "pointer")
            .transition()
            .duration(animationDuration)
            .delay(i * 100 + 200)
            .attr("y", y(d.q3))
            .attr("height", y(d.q1) - y(d.q3));

        // Add interactive events to box
        box.on("click", function(event) {
            event.stopPropagation();
            if (selectedClassification === d.classification) {
                // Deselect if clicking the same box
                selectedClassification = null;
                showStripPlot = false;
                drawBoxPlots(boxPlotData);
                infoPanel.style("display", "none");
            } else {
                // Select this box
                selectedClassification = d.classification;
                drawBoxPlots(boxPlotData, d.classification);
                updateInfoPanel(d);
                toggleStripPlot(d.classification);
            }
        })
        .on("mouseover", function(event) {
            if (!selectedClassification || selectedClassification === d.classification) {
                d3.select(this)
                    .attr("stroke-width", 4)
                    .attr("stroke", "white")
                    .attr("filter", "drop-shadow(0px 0px 8px rgba(255,255,255,0.8))");
                
                const tooltipHtml = "<strong>" + d.classification + "</strong><br/>" +
                    "<strong>Count:</strong> " + d.values.length + "<br/>" +
                    "<strong>Min:</strong> " + d.min.toFixed(1) + "<br/>" +
                    "<strong>Q1:</strong> " + d.q1.toFixed(1) + "<br/>" +
                    "<strong>Median:</strong> " + d.median.toFixed(1) + "<br/>" +
                    "<strong>Q3:</strong> " + d.q3.toFixed(1) + "<br/>" +
                    "<strong>Max:</strong> " + d.max.toFixed(1) + "<br/>" +
                    "<strong>Outliers:</strong> " + d.outliers.length + "<br/>" +
                    "<em>Click to show individual points</em>";
                
                tooltip
                    .style("opacity", 1)
                    .html(tooltipHtml)
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 10) + "px");
            }
        })
        .on("mousemove", function(event) {
            tooltip
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 10) + "px");
        })
        .on("mouseout", function() {
            if (!selectedClassification || selectedClassification === d.classification) {
                d3.select(this)
                    .attr("stroke-width", isHighlighted ? 3 : 2)
                    .attr("stroke", "#333")
                    .attr("filter", null);
                tooltip.style("opacity", 0);
            }
        });

        // Draw median line
        boxGroup.append("line")
            .attr("x1", xPos - boxWidth / 2)
            .attr("x2", xPos + boxWidth / 2)
            .attr("y1", y(d.median))
            .attr("y2", y(d.median))
            .attr("stroke", "#333")
            .attr("stroke-width", isHighlighted ? 3 : 2)
            .attr("opacity", opacity);

        // Draw outliers
        if (d.outliers.length > 0) {
            d.outliers.forEach((outlier, idx) => {
                const jitter = (Math.random() - 0.5) * boxWidth * 0.8;
                const outlierCircle = boxGroup.append("circle")
                    .attr("cx", xPos + jitter)
                    .attr("cy", height)
                    .attr("r", 0)
                    .attr("fill", color)
                    .attr("stroke", "#333")
                    .attr("stroke-width", 1)
                    .attr("opacity", opacity)
                    .attr("class", "outlier")
                    .transition()
                    .duration(animationDuration)
                    .delay(i * 100 + 400 + idx * 20)
                    .attr("cy", y(outlier))
                    .attr("r", 3);

                outlierCircle.on("mouseover", function(event) {
                    if (!isDimmed) {
                        d3.select(this).attr("r", 5);
                        const outlierTooltipHtml = "<strong>Outlier</strong><br/>" +
                            "<strong>Classification:</strong> " + d.classification + "<br/>" +
                            "<strong>Value:</strong> " + outlier.toFixed(1);
                        tooltip
                            .style("opacity", 1)
                            .html(outlierTooltipHtml)
                            .style("left", (event.pageX + 10) + "px")
                            .style("top", (event.pageY - 10) + "px");
                    }
                })
                .on("mousemove", function(event) {
                    tooltip
                        .style("left", (event.pageX + 10) + "px")
                        .style("top", (event.pageY - 10) + "px");
                })
                .on("mouseout", function() {
                    if (!isDimmed) {
                        d3.select(this).attr("r", 3);
                        tooltip.style("opacity", 0);
                    }
                });
            });
        }
    });

    // Update axes
    svg.selectAll(".x-axis").remove();
    svg.selectAll(".y-axis").remove();

    // Add X axis
    svg.append("g")
        .attr("class", "x-axis")
        .attr("transform", "translate(0," + height + ")")
        .call(d3.axisBottom(x))
        .selectAll("text")
        .style("text-anchor", "middle")
        .style("font-size", "12px")
        .style("fill", "#333")
        .attr("dx", "0em")
        .attr("dy", "1em");

    // Add Y axis
    svg.append("g")
        .attr("class", "y-axis")
        .call(d3.axisLeft(y))
        .selectAll("text")
        .style("fill", "#333");
}

// Function to toggle strip plot (individual data points)
function toggleStripPlot(classification) {
    if (showStripPlot) {
        svg.selectAll(".strip-plot-group").remove();
        showStripPlot = false;
        return;
    }

    const selectedData = validData.filter(d => d.classification === classification);
    const classificationOrder = ["Extreme Fear", "Fear", "Neutral", "Greed", "Extreme Greed"];
    const colorScale = d3.scaleOrdinal()
        .domain(classificationOrder)
        .range(["#8B0000", "#FF6B6B", "#FFD93D", "#6BCF7F", "#00A86B"]);
    
    const x = d3.scaleBand()
        .domain([classification])
        .range([0, width])
        .padding(0.3);

    const y = d3.scaleLinear()
        .domain([0, 100])
        .nice()
        .range([height, 0]);

    const xPos = x(classification) + x.bandwidth() / 2;
    const boxWidth = x.bandwidth() * 0.7;
    const color = colorScale(classification);

    // Create strip plot group
    const stripGroup = svg.append("g")
        .attr("class", "strip-plot-group");

    // Add individual data points with jitter
    selectedData.forEach((d, idx) => {
        const jitter = (Math.random() - 0.5) * boxWidth * 0.9;
        const point = stripGroup.append("circle")
            .attr("cx", xPos + jitter)
            .attr("cy", height)
            .attr("r", 0)
            .attr("fill", color)
            .attr("stroke", "white")
            .attr("stroke-width", 1)
            .attr("opacity", 0.6)
            .style("cursor", "pointer")
            .transition()
            .duration(300)
            .delay(idx * 2)
            .attr("cy", y(d.value))
            .attr("r", 3);

        point.on("mouseover", function(event) {
            d3.select(this)
                .attr("r", 6)
                .attr("opacity", 1)
                .attr("stroke-width", 2);
            
            const tooltipHtml = "<strong>Date:</strong> " + d.timestamp.toLocaleDateString() + "<br/>" +
                "<strong>Value:</strong> " + d.value.toFixed(1) + "<br/>" +
                "<strong>Classification:</strong> " + d.classification;
            
            tooltip
                .style("opacity", 1)
                .html(tooltipHtml)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 10) + "px");
        })
        .on("mousemove", function(event) {
            tooltip
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 10) + "px");
        })
        .on("mouseout", function() {
            d3.select(this)
                .attr("r", 3)
                .attr("opacity", 0.6)
                .attr("stroke-width", 1);
            tooltip.style("opacity", 0);
        });
    });

    showStripPlot = true;
}

// Function to update info panel
function updateInfoPanel(d) {
    const colorScale = d3.scaleOrdinal()
        .domain(["Extreme Fear", "Fear", "Neutral", "Greed", "Extreme Greed"])
        .range(["#8B0000", "#FF6B6B", "#FFD93D", "#6BCF7F", "#00A86B"]);
    const color = colorScale(d.classification);
    
    const htmlContent = "<strong style=\"font-size: 14px; color: " + color + ";\">" +
        d.classification + "</strong><br/>" +
        "<hr style=\"margin: 8px 0; border: 1px solid #ddd;\">" +
        "<strong>Observations:</strong> " + d.values.length + "<br/>" +
        "<strong>Min:</strong> " + d.min.toFixed(1) + "<br/>" +
        "<strong>Q1:</strong> " + d.q1.toFixed(1) + "<br/>" +
        "<strong>Median:</strong> " + d.median.toFixed(1) + "<br/>" +
        "<strong>Q3:</strong> " + d.q3.toFixed(1) + "<br/>" +
        "<strong>Max:</strong> " + d.max.toFixed(1) + "<br/>" +
        "<strong>IQR:</strong> " + d.iqr.toFixed(1) + "<br/>" +
        "<strong>Outliers:</strong> " + d.outliers.length + "<br/>" +
        "<hr style=\"margin: 8px 0; border: 1px solid #ddd;\">" +
        "<em style=\"font-size: 10px;\">Click box again to deselect</em>";
    
    infoPanel
        .style("display", "block")
        .html(htmlContent);
}

// Load fear_greed_index.csv
d3.csv("fear_greed_index.csv").then(function(data) {
    // Process data
    data.forEach(d => {
        d.value = +d.value;
        d.timestamp = new Date(d.timestamp * 1000);
    });

    // Filter out any invalid data
    validData = data.filter(d => !isNaN(d.value) && d.classification);

    // Group data by classification
    const grouped = d3.group(validData, d => d.classification);
    
    // Order of classifications (from fear to greed)
    const classificationOrder = ["Extreme Fear", "Fear", "Neutral", "Greed", "Extreme Greed"];
    
    // Calculate box plot statistics for each group
    boxPlotData = classificationOrder.map(classification => {
        const groupData = grouped.get(classification);
        if (!groupData || groupData.length === 0) return null;
        
        const values = groupData.map(d => d.value);
        const stats = calculateBoxPlotStats(values);
        
        return {
            classification: classification,
            values: values,
            rawData: groupData,
            ...stats
        };
    }).filter(d => d !== null);

    // Draw initial box plots
    drawBoxPlots(boxPlotData);

    // Add click handler to deselect when clicking background
    svg.append("rect")
        .attr("width", width)
        .attr("height", height)
        .attr("fill", "transparent")
        .style("cursor", "default")
        .on("click", function() {
            selectedClassification = null;
            showStripPlot = false;
            drawBoxPlots(boxPlotData);
            infoPanel.style("display", "none");
        });

    // Add Y axis label
    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", -50)
        .attr("x", -height / 2)
        .attr("dy", "1em")
        .style("text-anchor", "middle")
        .style("font-size", "14px")
        .style("fill", "#333")
        .text("Fear & Greed Index Value");

    // Add X axis label
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", height + 50)
        .style("text-anchor", "middle")
        .style("font-size", "14px")
        .style("fill", "#333")
        .text("Classification");

    // Add title
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", -10)
        .attr("text-anchor", "middle")
        .style("font-size", "18px")
        .style("font-weight", "bold")
        .style("fill", "#333")
        .text("Fear & Greed Index Distribution by Classification");

    // Add instructions
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", height + 70)
        .style("text-anchor", "middle")
        .style("font-size", "11px")
        .style("fill", "#666")
        .style("font-style", "italic")
        .text("Click a box to highlight and show individual data points | Click background to reset");

}).catch(function(error) {
    console.error("Error loading or processing data:", error);
    d3.select("#my_dataviz")
        .append("p")
        .style("color", "red")
        .text("Error loading data. Please check that fear_greed_index.csv is available.");
});
