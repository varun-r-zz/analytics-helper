CREATE TABLE following_bak2 LIKE following;
INSERT following_bak2 SELECT * FROM following;

SET SQL_SAFE_UPDATES = 0;

DELETE FROM following
WHERE id IN 
(SELECT id FROM
(SELECT a.id
FROM following a
JOIN users b
ON a.target_id = b.id
WHERE DATEDIFF(NOW(),b.last_seen_at) >=30
AND DATEDIFF(NOW(),b.last_action_at) >=30
ORDER BY b.last_seen_at DESC
) a
)
;

SET SQL_SAFE_UPDATES = 1;// Modified from Kerry Rodden's "sequence sunburst"
  // https://bl.ocks.org/kerryrodden/7090426
  sunburstChart: function(o) {
    var id = alamode.makeId(10);

    var queryName = o["query_name"],
        eventColumns = o["event_columns"],
        valueColumn = o["event_counts"],
                // Optional
        title = o["title"] || queryName,
        colorRange = o["color_range"] || ["#e41a1c","#377eb8","#4daf4a","#984ea3","#ff7f00","#ffff33","#a65628","#f781bf","#999999"],
        htmlElement = o["html_element"] || "body";

    var data = alamode.getDataFromQuery(queryName);

    var height = 600,
        width = 850,
        radius = Math.min(width, height) / 2,
        breadcrumbWidth = (width - 50)/eventColumns.length*3,
        b = { w: breadcrumbWidth, h: 20, s: 3, t: 10 };

    var fullEventList = [];

    eventColumns.forEach(function(e) {
      fullEventList = fullEventList.concat(_.uniq(_.map(data,e)));
    })

    var events = _.uniq(fullEventList)

    var colors = {}

    events.forEach(function(e,i) {
      if (e != null) { colors[e] = colorRange[i % (colorRange.length)]; }
    })

    colors["activation"] = "#666"

    var totalSize = 0;

    var uniqContainerClass = alamode.addContainerElement(htmlElement);

    d3.select(uniqContainerClass)
        .append("div")
        .attr("class","mode-graphic-title")
        .text(title)

    d3.select(uniqContainerClass)
        .append("div")
        .attr("class","mode-sunburst-sequence")
        .attr("id","sequence-" + id)

    d3.select(uniqContainerClass)
        .append("div")
        .attr("class","mode-sunburst")
        .attr("id",id)

    d3.select(uniqContainerClass)
        .append("div")
        .attr("class","mode-sunburst-legend-container")
        .attr("id","legend-container-" + id)

    vis = d3.select("#" + id).append("svg:svg")
        .attr("width", width)
        .attr("height", height)
      .append("svg:g")
        .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");

    vis.append("text")
        .attr("x",0)
        .attr("y",-30)
        .attr("text-anchor","middle")
        .attr("class","mode-sunburst-explanation mode-sunburst-percentage")
        .attr("id","percentage-" + id)
        .style("visibility","hidden")
        .text("");

    vis.append("text")
        .attr("x",0)
        .attr("y",-10)
        .attr("text-anchor","middle")
        .attr("class","mode-sunburst-explanation")
        .style("visibility","hidden")
        .text("of total sequences.")

    vis.append("text")
        .attr("x",0)
        .attr("y",20)
        .attr("text-anchor","middle")
        .attr("class","mode-sunburst-explanation mode-sunburst-cond-percentage")
        .attr("id","cond-percentage-" + id)
        .style("visibility","hidden")
        .text("")

    vis.append("text")
        .attr("x",0)
        .attr("y",40)
        .attr("text-anchor","middle")
        .attr("class","mode-sunburst-explanation")
        .style("visibility","hidden")
        .text("from previous location.")

    var partition = d3.layout.partition()
        .size([2 * Math.PI, radius * radius])
        .value(function(d) { return d.size; });

    var arc = d3.svg.arc()
        .startAngle(function(d) { return d.x; })
        .endAngle(function(d) { return d.x + d.dx; })
        .innerRadius(function(d) { return Math.sqrt(d.y); })
        .outerRadius(function(d) { return Math.sqrt(d.y + d.dy); });

    var formattedData = [];

    data.forEach(function(d) {
      var sequence = "";

      for (i=0; i<eventColumns.length; i++) {

        if (i != 0) { prefix = "-~-"; } else { prefix = ""; }

        if (d[eventColumns[i]] == null) {
          sequence = sequence + prefix + "activation";
          break;
        } else {
          sequence = sequence + prefix + d[eventColumns[i]];
        }
      }

      var ent = {0:sequence, 1:d[valueColumn]}

      formattedData.push(ent)
    })

    var json = buildHierarchy(formattedData);

    createVisualization(json);

    function createVisualization(json) {

      initializeBreadcrumbTrail();
      drawLegend();

      vis.append("svg:circle")
          .attr("r", radius)
          .style("opacity", 0);

      var nodes = partition.nodes(json)
        .filter(function(d) {
            return (d.dx > 0.005);
        });

      var path = vis.data([json]).selectAll("path")
          .data(nodes)
        .enter().append("svg:path")
          .attr("display", function(d) { return d.depth ? null : "none"; })
          .attr("d", arc)
          .attr("fill-rule", "evenodd")
          .style("fill", function(d) { return colors[d.name]; })
          .style("opacity", 1)
          .on("mouseover", mouseover);

      vis.on("mouseleave", mouseleave);

      totalSize = path.node().__data__.value;
    };

    function mouseover(d) {

      var percentage = (100 * d.value / totalSize).toPrecision(3);
      var percentageString = percentage + "%";
      if (percentage < 0.1) {
        percentageString = "< 0.1%";
      }

      //Calculate conditional percentage
      var sequenceArray = getAncestors(d);
      var parent_conditional_value = d.parent.value;
      var cond_percentage = (100*d.value/parent_conditional_value).toPrecision(3);
      var cond_percentageString = cond_percentage + "%";
        if (cond_percentage < 1.0) {
        percentageString = "< 1%";
      }

      d3.select("#cond-percentage-" + id)
          .text(cond_percentageString);

      d3.select("#percentage-" + id)
          .text(percentageString);

      d3.selectAll(".mode-sunburst-explanation")
          .style("visibility", "");

      var sequenceArray = getAncestors(d);
      updateBreadcrumbs(sequenceArray, percentageString);

      d3.selectAll("path")
          .style("opacity", 0.3);

      vis.selectAll("path")
          .filter(function(node) {
                    return (sequenceArray.indexOf(node) >= 0);
                  })
          .style("opacity", 1);
    }

    function mouseleave(d) {

      d3.select("#trail-" + id)
          .style("visibility", "hidden");

      d3.selectAll("path").on("mouseover", null);

      // Compatibility for d3 v3 and v4
      if (d3.version.split(".")[0] == 4) {
        d3.selectAll("path")
            .transition()
            .duration(300)
            .style("opacity", 1)
            .on("activation", function() {
              d3.select(this).on("mouseover", mouseover);
            })
      } else {
        d3.selectAll("path")
            .transition()
            .duration(300)
            .style("opacity", 1)
            .each("activation", function() {
              d3.select(this).on("mouseover", mouseover);
            })
      }

      d3.selectAll(".mode-sunburst-explanation")
          .style("visibility", "hidden");
    }

    function getAncestors(node) {
      var path = [];
      var current = node;
      while (current.parent) {
        path.unshift(current);
        current = current.parent;
      }
      return path;
    }

    function initializeBreadcrumbTrail() {
      var trail = d3.select("#sequence-" + id).append("svg:svg")
          .attr("width", width)
          .attr("height", 60)
          .attr("id", "trail-" + id);

      trail.append("svg:text")
        .attr("id", "activationlabel")
        .style("fill", "#000");
    }

    function breadcrumbPoints(d, i) {
      var points = [];
      points.push("0,0");
      points.push(b.w + ",0");
      points.push(b.w + b.t + "," + (b.h / 2));
      points.push(b.w + "," + b.h);
      points.push("0," + b.h);
      if (i > 0) {
        points.push(b.t + "," + (b.h / 2));
      }
      return points.join(" ");
    }

    function updateBreadcrumbs(nodeArray, percentageString) {

      var g = d3.select("#trail-" + id)
          .selectAll("g")
          .data(nodeArray, function(d) { return d.name + d.depth; });

      var entering = g.enter().append("svg:g");

      entering.append("svg:polygon")
          .attr("points", breadcrumbPoints)
          .style("fill", function(d) { return colors[d.name]; });

      entering.append("svg:text")
          .attr("x", (b.w + b.t) / 2)
          .attr("y", b.h / 2)
          .attr("dy", "0.35em")
          .attr("text-anchor", "middle")
          .text(function(d) { return d.name; });

      g.attr("transform", function(d, i) {
        if (i > 3 && i < 8){
          i = i - 4;
          return "translate(" + i * (b.w + b.s) + ", 20)";
        }else if (i > 8){
          i = i - 9;
          return "translate(" + i * (b.w + b.s) + ", 40)";
        }else{
          return "translate(" + i * (b.w + b.s) + ", 0)";
        }
      });

      g.exit().remove();

      d3.select("#trail-" + id)
          .style("visibility", "");
    }

    function drawLegend() {

      var li = {
        w: 195, h: 30, s: 3, r: 3
      };

      d3.entries(colors).forEach(function(c) {

        divContainer = d3.select("#legend-container-" + id)
            .append("div")
            .attr("class","mode-sunburst-legend")
            .attr("id","legend-" + id)

        svg = divContainer.append("svg:svg")
            .attr("width", li.w)
            .attr("height", li.h);

        svg.append("svg:rect")
            .attr("rx", li.r)
            .attr("ry", li.r)
            .attr("width", li.w)
            .attr("height", li.h)
            .style("fill", function() { return c.value; });

        svg.append("svg:text")
            .attr("x", li.w / 2)
            .attr("y", li.h / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", "middle")
            .text(function() { return c.key; });
      })

    }


    function buildHierarchy(csv) {
      var root = {"name": "root", "children": []};
      for (var i = 0; i < csv.length; i++) {
        var sequence = csv[i][0];
        var size = +csv[i][1];
        if (isNaN(size)) {
          continue;
        }
        var parts = sequence.split("-~-");
        var currentNode = root;
        for (var j = 0; j < parts.length; j++) {
          var children = currentNode["children"];
          var nodeName = parts[j];
          var childNode;
          if (j + 1 < parts.length) {

      var foundChild = false;
      for (var k = 0; k < children.length; k++) {
        if (children[k]["name"] == nodeName) {
          childNode = children[k];
          foundChild = true;
          break;
        }
      }

      if (!foundChild) {
        childNode = {"name": nodeName, "children": []};
        children.push(childNode);
      }
      currentNode = childNode;
          } else {

      childNode = {"name": nodeName, "size": size};
      children.push(childNode);
          }
        }
      }
      return root;
    };
  },
