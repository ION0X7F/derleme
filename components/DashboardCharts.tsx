"use client";

import { useEffect, useRef } from "react";

type BarChartProps = {
  labels: string[];
  values: number[];
  colors: string[];
  title: string;
};

type LineChartProps = {
  labels: string[];
  datasets: { label: string; data: number[]; color: string }[];
};

type DestroyableChart = {
  destroy: () => void;
};

export function BarChart({ labels, values, colors, title }: BarChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    let chart: DestroyableChart | null = null;

    async function init() {
      const { Chart, registerables } = await import("chart.js");
      Chart.register(...registerables);

      chart?.destroy();
      chart = new Chart(canvasRef.current!, {
        type: "bar",
        data: {
          labels,
          datasets: [
            {
              label: title,
              data: values,
              backgroundColor: colors,
              borderRadius: 10,
              borderSkipped: false,
              maxBarThickness: 48,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: { color: "rgba(100, 116, 139, 0.12)" },
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
      chart?.destroy();
    };
  }, [labels, values, colors, title]);

  return (
    <div className="dashboard-chart-canvas">
      <canvas ref={canvasRef} />
    </div>
  );
}

export function LineChart({ labels, datasets }: LineChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    let chart: DestroyableChart | null = null;

    async function init() {
      const { Chart, registerables } = await import("chart.js");
      Chart.register(...registerables);

      chart?.destroy();
      chart = new Chart(canvasRef.current!, {
        type: "line",
        data: {
          labels,
          datasets: datasets.map((dataset) => ({
            label: dataset.label,
            data: dataset.data,
            borderColor: dataset.color,
            backgroundColor: `${dataset.color}18`,
            fill: true,
            tension: 0.35,
            pointRadius: 4,
            pointHoverRadius: 5,
            pointBackgroundColor: dataset.color,
          })),
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: "top",
              align: "start",
              labels: {
                font: { size: 11 },
                boxWidth: 12,
                usePointStyle: true,
              },
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: { color: "rgba(100, 116, 139, 0.12)" },
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
      chart?.destroy();
    };
  }, [labels, datasets]);

  return (
    <div className="dashboard-chart-canvas">
      <canvas ref={canvasRef} />
    </div>
  );
}
