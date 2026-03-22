"use client";

import { useEffect, useRef } from "react";

type BarChartProps = {
  labels: string[];
  values: number[];
  colors: string[];
  title: string;
};

export function BarChart({ labels, values, colors, title }: BarChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    let chart: any;

    async function init() {
      const { Chart, registerables } = await import("chart.js");
      Chart.register(...registerables);
      if (chart) chart.destroy();
      chart = new Chart(canvasRef.current!, {
        type: "bar",
        data: {
          labels,
          datasets: [
            {
              label: title,
              data: values,
              backgroundColor: colors,
              borderRadius: 8,
              borderSkipped: false,
            },
          ],
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            y: {
              beginAtZero: true,
              grid: { color: "rgba(0,0,0,0.05)" },
              ticks: { font: { size: 11 } },
            },
            x: {
              grid: { display: false },
              ticks: { font: { size: 11 } },
            },
          },
        },
      });
    }

    init();
    return () => {
      if (chart) chart.destroy();
    };
  }, [labels, values, colors, title]);

  return <canvas ref={canvasRef} />;
}

type LineChartProps = {
  labels: string[];
  datasets: { label: string; data: number[]; color: string }[];
};

export function LineChart({ labels, datasets }: LineChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    let chart: any;

    async function init() {
      const { Chart, registerables } = await import("chart.js");
      Chart.register(...registerables);
      if (chart) chart.destroy();
      chart = new Chart(canvasRef.current!, {
        type: "line",
        data: {
          labels,
          datasets: datasets.map((d) => ({
            label: d.label,
            data: d.data,
            borderColor: d.color,
            backgroundColor: d.color + "18",
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointBackgroundColor: d.color,
          })),
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              position: "top",
              labels: { font: { size: 11 }, boxWidth: 12 },
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: { color: "rgba(0,0,0,0.05)" },
              ticks: { font: { size: 11 } },
            },
            x: {
              grid: { display: false },
              ticks: { font: { size: 11 } },
            },
          },
        },
      });
    }

    init();
    return () => {
      if (chart) chart.destroy();
    };
  }, [labels, datasets]);

  return <canvas ref={canvasRef} />;
}
