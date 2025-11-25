// Dimensions
const margin = { top: 20, right: 30, bottom: 60, left: 80 };
const width = 960 - margin.left - margin.right;
const height = 500 - margin.top - margin.bottom;

// Append the SVG object to the body of the page
const svg = d3.select("#my_dataviz")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

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
    .style("font-size", "12px");

// Load both datasets
Promise.all([
    d3.csv("btcusd_1-min_data.csv"),
    d3.csv("fear_greed_index.csv")
]).then(function(datasets) {
    const btcData = datasets[0];
    const fearGreedData = datasets[1];

    // Process BTC data
    btcData.forEach(d => {
        d.Timestamp = new Date(d.Timestamp * 1000);
        d.Close = +d.Close;
    });

    // Process Fear & Greed data
    fearGreedData.forEach(d => {
        d.timestamp = new Date(d.timestamp * 1000);
        d.value = +d.value;
    });

    // Create a map of BTC prices by date (using date as key, ignoring time)
    const btcPriceMap = new Map();
    btcData.forEach(d => {
        const dateKey = d.Timestamp.toISOString().split('T')[0];
        if (!btcPriceMap.has(dateKey) || d.Close > btcPriceMap.get(dateKey)) {
            btcPriceMap.set(dateKey, d.Close);
        }
    });

    // Add BTC price to Fear & Greed data where available
    fearGreedData.forEach(d => {
        const dateKey = d.timestamp.toISOString().split('T')[0];
        d.btcPrice = btcPriceMap.get(dateKey) || null;
    });

    // Sort data by timestamp
    fearGreedData.sort((a, b) => a.timestamp - b.timestamp);

    // Filter to show a reasonable number of bars (e.g., daily data)
    let displayData = fearGreedData;
    if (fearGreedData.length > 100) {
        const step = Math.ceil(fearGreedData.length / 100);
        displayData = fearGreedData.filter((d, i) => i % step === 0);
    }

    // X axis: scale for time
    const x = d3.scaleBand()
        .range([0, width])
        .domain(displayData.map(d => d.timestamp))
        .padding(0.2);

    // Y axis: scale for value
    const y = d3.scaleLinear()
        .domain([0, d3.max(displayData, d => d.value)])
        .nice()
        .range([height, 0]);

    // Color scale based on classification
    const colorScale = d3.scaleOrdinal()
        .domain(["Extreme Fear", "Fear", "Neutral", "Greed", "Extreme Greed"])
        .range(["#8B0000", "#FF6B6B", "#FFD93D", "#6BCF7F", "#00A86B"]);

    // Add X axis
    const xAxis = svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x)
            .tickFormat(d3.timeFormat("%Y-%m-%d"))
            .ticks(10))
        .selectAll("text")
        .attr("transform", "translate(-10,0)rotate(-45)")
        .style("text-anchor", "end")
        .style("font-size", "10px");

    // Add Y axis
    svg.append("g")
        .call(d3.axisLeft(y))
        .append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", -50)
        .attr("x", -height / 2)
        .attr("dy", "1em")
        .style("text-anchor", "middle")
        .style("fill", "white")
        .text("Fear & Greed Index");

    // Bars
    svg.selectAll("mybar")
        .data(displayData)
        .enter()
        .append("rect")
        .attr("x", d => x(d.timestamp))
        .attr("y", d => y(d.value))
        .attr("width", x.bandwidth())
        .attr("height", d => height - y(d.value))
        .attr("fill", d => {
            // Use classification if available, otherwise use value-based color
            if (d.classification) {
                return colorScale(d.classification) || "#69b3a2";
            }
            // Fallback: color by value
            if (d.value <= 25) return "#8B0000"; // Extreme Fear
            if (d.value <= 45) return "#FF6B6B"; // Fear
            if (d.value <= 55) return "#FFD93D"; // Neutral
            if (d.value <= 75) return "#6BCF7F"; // Greed
            return "#00A86B"; // Extreme Greed
        })
        .attr("stroke", "#333")
        .attr("stroke-width", 0.5)
        .on("mouseover", function(event, d) {
            // Highlight bar on hover
            d3.select(this)
                .attr("opacity", 0.7)
                .attr("stroke-width", 2)
                .attr("stroke", "white");

            // Show tooltip
            let tooltipText = `<strong>Date:</strong> ${d.timestamp.toLocaleDateString()}<br/>`;
            tooltipText += `<strong>Fear & Greed Index:</strong> ${d.value}<br/>`;
            if (d.classification) {
                tooltipText += `<strong>Classification:</strong> ${d.classification}<br/>`;
            }
            if (d.btcPrice) {
                tooltipText += `<strong>BTC Price:</strong> $${d.btcPrice.toFixed(2)}`;
            }

            tooltip
                .style("opacity", 1)
                .html(tooltipText)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 10) + "px");
        })
        .on("mousemove", function(event) {
            tooltip
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 10) + "px");
        })
        .on("mouseout", function(event, d) {
            // Revert bar appearance
            d3.select(this)
                .attr("opacity", 1)
                .attr("stroke-width", 0.5)
                .attr("stroke", "#333");

            // Hide tooltip
            tooltip.style("opacity", 0);
        });

    // Add title
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", -5)
        .attr("text-anchor", "middle")
        .style("font-size", "16px")
        .style("font-weight", "bold")
        .style("fill", "white")
        .text("Fear & Greed Index Over Time");
//Debug issues
}).catch(function(error) {
    console.error("Error loading or processing data:", error);
    d3.select("#my_dataviz")
        .append("p")
        .style("color", "red")
        .text("Error loading data. Please check that the CSV files are available.");
});

