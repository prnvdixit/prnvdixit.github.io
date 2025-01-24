import * as d3 from "d3";
import cloud, { Word } from "d3-cloud";

export class TagCloud {
  private container: HTMLElement;
  private width: number;
  private height: number;
  private onTagClick: (tag: string) => void;

  constructor(
    container: HTMLElement,
    width: number,
    height: number,
    onTagClick: (tag: string) => void
  ) {
    this.container = container;
    this.width = width;
    this.height = height;
    this.onTagClick = onTagClick;

    // Add resize handler with debounce
    const handleResize = () => {
      this.width = this.container.clientWidth;
      if (this.tagData) {
        this.render(this.tagData);
      }
    };

    window.addEventListener("resize", this.debounce(handleResize, 250));
  }

  private tagData: Map<string, number> | null = null;

  private debounce(func: Function, wait: number): (...args: any[]) => void {
    let timeout: NodeJS.Timeout;
    return (...args: any[]) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  public async render(tagFrequencies: Map<string, number>): Promise<void> {
    this.tagData = tagFrequencies; // Store for resize handling
    // Clear any existing content
    this.container.innerHTML = "";

    // Convert tag frequencies to array format required by d3-cloud
    // Cache the results to avoid recalculation
    const tags = Array.from(tagFrequencies.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 100) // Limit to top 100 tags for better performance
      .map(([text, size]) => ({
        text,
        size: Math.min(8 + size * 6, 40), // Adjusted font size calculation for better distribution
      }));

    // Create the layout
    const layout = cloud()
      .size([this.width, this.height])
      .words(tags)
      .padding(5)
      .rotate(() => 0) // No rotation for better readability
      .font("Arial")
      .fontSize((d: Word) => d.size || 10)
      .on("end", (words) => this.draw(words));

    // Start the layout
    layout.start();
  }

  private draw(words: any[]): void {
    // Create SVG container
    const svg = d3
      .select(this.container)
      .append("svg")
      .attr("width", this.width)
      .attr("height", this.height)
      .append("g")
      .attr("transform", `translate(${this.width / 2},${this.height / 2})`);

    const self = this; // Store reference to class instance

    // Add words
    svg
      .selectAll("text")
      .data(words)
      .enter()
      .append("text")
      .style("font-size", (d) => `${d.size}px`)
      .style("font-family", "Arial")
      .style("cursor", "pointer")
      .style("fill", (_d, i) => d3.schemeCategory10[i % 10])
      .attr("text-anchor", "middle")
      .attr("transform", (d) => `translate(${d.x},${d.y})`)
      .each(function (d) {
        const text = d3.select(this);
        text.text(d.text);

        // Add superscript with actual tag frequency count
        text
          .append("tspan")
          .attr("dx", "2")
          .attr("dy", "-0.6em")
          .style("font-size", "0.5em")
          .text(self.tagData?.get(d.text) || 0);
      })
      .on("click", (event, d) => {
        event.preventDefault();
        this.onTagClick(d.text);
      })
      .on("mouseover", function () {
        d3.select(this).style("opacity", 0.7);
      })
      .on("mouseout", function () {
        d3.select(this).style("opacity", 1);
      });
  }
}
