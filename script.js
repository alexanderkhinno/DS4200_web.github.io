// Debug: Check if script is loading
console.log("Script.js loaded successfully");

// Dimensions
const margin = { top: 40, right: 30, bottom: 80, left: 80 };
const width = 960 - margin.left - margin.right;
const height = 500 - margin.top - margin.bottom;

// Create main SVG
const svg = d3.select("#my_dataviz")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom);

// Create container for zoomable content
const g = svg.append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

// Create tooltip
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

// Color scale based on classification
const colorScale = d3.scaleOrdinal()
    .domain(["Extreme Fear", "Fear", "Neutral", "Greed", "Extreme Greed"])
    .range(["#8B0000", "#FF6B6B", "#FFD93D", "#6BCF7F", "#00A86B"]);

// Show loading indicator
d3.select("#my_dataviz")
    .append("div")
    .attr("id", "loading-indicator")
    .style("text-align", "center")
    .style("padding", "20px")
    .style("color", "#333")
    .html("<p>Loading data...</p>");

// Check if we're using file:// protocol (which causes CORS issues)
if (window.location.protocol === "file:") {
    console.warn("WARNING: Opening file directly (file://) will cause CORS errors!");
    console.warn("Please run: python -m http.server 8000");
    console.warn("Then open: http://localhost:8000/index.html");
}

console.log("Attempting to load fear_greed_index.csv...");

// Load and process data
d3.csv("fear_greed_index.csv").then(function(data) {
    // Remove loading indicator
    d3.select("#loading-indicator").remove();
    
    console.log("Data loaded successfully. Rows:", data.length);
    
    // Process data
    data.forEach(d => {
        d.value = +d.value;
        d.timestamp = new Date(d.timestamp * 1000);
    });

    // Filter valid data and sort by timestamp
    const validData = data.filter(d => !isNaN(d.value) && d.classification)
        .sort((a, b) => a.timestamp - b.timestamp);
    
    console.log("Valid data rows:", validData.length);
    
    if (validData.length === 0) {
        throw new Error("No valid data found after filtering. Check CSV structure.");
    }

    // Create initial scales
    const xTime = d3.scaleTime()
        .domain(d3.extent(validData, d => d.timestamp))
        .range([0, width]);

    const y = d3.scaleLinear()
        .domain([0, d3.max(validData, d => d.value)])
        .nice()
        .range([height, 0]);

    // Calculate bar width based on data density
    const timeRange = xTime.domain()[1] - xTime.domain()[0];
    const avgBarWidth = width / validData.length;
    const barWidth = Math.max(1, Math.min(avgBarWidth * 0.8, 5));

    // Create zoom behavior
    let zoomTransform = d3.zoomIdentity;
    
    const zoom = d3.zoom()
        .scaleExtent([0.5, 20])
        .extent([[0, 0], [width, height]])
        .on("zoom", function(event) {
            zoomTransform = event.transform;
            updateChart();
        });

    // Store references for zoom updates
    let bars, xAxis, yAxis;

    // Function to update chart based on zoom transform
    function updateChart() {
        const newXTime = zoomTransform.rescaleX(xTime);
        const newY = zoomTransform.rescaleY(y);
        
        // Update bars
        bars.attr("x", d => newXTime(d.timestamp) - barWidth / 2)
            .attr("width", barWidth)
            .attr("y", d => newY(d.value))
            .attr("height", d => height - newY(d.value));
        
        // Update axes
        xAxis.call(d3.axisBottom(newXTime).tickFormat(d3.timeFormat("%Y-%m-%d")));
        yAxis.call(d3.axisLeft(newY));
    }

    // Create zoom overlay (created first, so it's behind bars)
    const zoomOverlay = g.insert("rect", ":first-child")
        .attr("width", width)
        .attr("height", height)
        .attr("fill", "none")
        .attr("pointer-events", "all")
        .style("cursor", "move");

    // Draw bars (with pointer events)
    bars = g.selectAll(".bar")
        .data(validData)
        .enter()
        .append("rect")
        .attr("class", "bar")
        .attr("x", d => xTime(d.timestamp) - barWidth / 2)
        .attr("width", barWidth)
        .attr("y", d => y(d.value))
        .attr("height", d => height - y(d.value))
        .attr("fill", d => colorScale(d.classification))
        .attr("stroke", "#333")
        .attr("stroke-width", 0.5)
        .style("pointer-events", "all")
        .style("cursor", "pointer")
        .on("mouseover", function(event, d) {
            d3.select(this)
                .attr("stroke-width", 2)
                .attr("stroke", "white");
            
            tooltip
                .style("opacity", 1)
                .html("<strong>Date:</strong> " + d.timestamp.toLocaleDateString() + "<br/>" +
                      "<strong>Value:</strong> " + d.value.toFixed(1) + "<br/>" +
                      "<strong>Classification:</strong> " + d.classification)
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
                .attr("stroke-width", 0.5)
                .attr("stroke", "#333");
            tooltip.style("opacity", 0);
        })
        .on("click", function(event) {
            // Stop event propagation so zoom doesn't trigger on bar click
            event.stopPropagation();
        });

    // Apply zoom to overlay (after bars are created)
    zoomOverlay.call(zoom);

    // Add X axis
    xAxis = g.append("g")
        .attr("class", "x-axis")
        .attr("transform", "translate(0," + height + ")")
        .call(d3.axisBottom(xTime).tickFormat(d3.timeFormat("%Y-%m-%d")));

    // Rotate x-axis labels
    xAxis.selectAll("text")
        .style("text-anchor", "end")
        .attr("dx", "-.8em")
        .attr("dy", ".15em")
        .attr("transform", "rotate(-45)")
        .style("font-size", "10px")
        .style("fill", "#333");

    // Add Y axis
    yAxis = g.append("g")
        .attr("class", "y-axis")
        .call(d3.axisLeft(y));

    yAxis.selectAll("text")
        .style("fill", "#333");

    // Add Y axis label
    g.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", -50)
        .attr("x", -height / 2)
        .attr("dy", "1em")
        .style("text-anchor", "middle")
        .style("font-size", "14px")
        .style("fill", "#333")
        .text("Fear & Greed Index Value");

    // Add title
    g.append("text")
        .attr("x", width / 2)
        .attr("y", -10)
        .attr("text-anchor", "middle")
        .style("font-size", "18px")
        .style("font-weight", "bold")
        .style("fill", "#333")
        .text("Fear & Greed Index Over Time");

    // Add instructions
    g.append("text")
        .attr("x", width / 2)
        .attr("y", height + 60)
        .style("text-anchor", "middle")
        .style("font-size", "11px")
        .style("fill", "#666")
        .style("font-style", "italic")
        .text("Scroll to zoom | Click and drag to pan | Hover over bars for details");

}).catch(function(error) {
    // Remove loading indicator if still present
    d3.select("#loading-indicator").remove();
    
    console.error("Error loading or processing data:", error);
    console.error("Error details:", error.message, error.stack);
    console.error("Error type:", error.constructor.name);
    
    // Show detailed error message
    const errorDiv = d3.select("#my_dataviz")
        .append("div")
        .style("color", "red")
        .style("padding", "20px")
        .style("background-color", "#ffebee")
        .style("border", "2px solid #f44336")
        .style("border-radius", "5px")
        .style("margin", "20px");
    
    errorDiv.append("h3")
        .style("margin-top", "0")
        .text("Error Loading Data");
    
    const errorMsg = error.message || error.toString() || "Unknown error";
    errorDiv.append("p")
        .style("font-weight", "bold")
        .text("Error message: " + errorMsg);
    
    errorDiv.append("p")
        .text("Please check:");
    
    const checklist = errorDiv.append("ul")
        .style("text-align", "left")
        .style("display", "inline-block");
    checklist.append("li").text("That fear_greed_index.csv exists in the same directory");
    checklist.append("li").text("That you're running a local web server (not opening file:// directly)");
    checklist.append("li").text("Check the browser console (F12) for more details");
    
    // Try to provide helpful debugging info
    if (errorMsg.includes("404") || errorMsg.includes("Not Found")) {
        errorDiv.append("p")
            .style("color", "orange")
            .style("font-weight", "bold")
            .text("File not found. Make sure fear_greed_index.csv is in the same directory as index.html");
    } else if (errorMsg.includes("CORS") || errorMsg.includes("Cross-Origin")) {
        errorDiv.append("p")
            .style("color", "orange")
            .style("font-weight", "bold")
            .text("CORS error: You need to run a local web server. Try: python -m http.server 8000");
    } else if (errorMsg.includes("Failed to fetch") || errorMsg.includes("NetworkError")) {
        errorDiv.append("p")
            .style("color", "orange")
            .style("font-weight", "bold")
            .text("Network error: Check your connection or try running a local server");
    }
    
    // Add refresh button
    errorDiv.append("button")
        .style("margin-top", "15px")
        .style("padding", "10px 20px")
        .style("background-color", "#4CAF50")
        .style("color", "white")
        .style("border", "none")
        .style("border-radius", "5px")
        .style("cursor", "pointer")
        .style("font-size", "14px")
        .text("Retry")
        .on("click", function() {
            location.reload();
        });
});
