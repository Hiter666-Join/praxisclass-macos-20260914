'use client';

import { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { BarChart, LineChart, RadarChart } from 'echarts/charts';
import {
  GridComponent,
  LegendComponent,
  RadarComponent,
  TooltipComponent,
} from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';

echarts.use([
  BarChart,
  LineChart,
  RadarChart,
  GridComponent,
  LegendComponent,
  RadarComponent,
  TooltipComponent,
  SVGRenderer,
]);

export type ChartOption = echarts.EChartsCoreOption;

export interface ChartTheme {
  dark: boolean;
  axis: string;
  split: string;
  palette: string[];
}

const LIGHT_PALETTE = ['#c64f3c', '#469ca7', '#c99a39', '#b96981', '#747d8c', '#353a45'];
const DARK_PALETTE = ['#ffa18f', '#7bc5ce', '#e8c476', '#dfa0b5', '#a7b1c2', '#e9edf5'];

export function chartTheme(): ChartTheme {
  const dark =
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  return {
    dark,
    axis: dark ? '#b8c0cc' : '#505966',
    split: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
    palette: dark ? DARK_PALETTE : LIGHT_PALETTE,
  };
}

interface EChartProps {
  option: ChartOption;
  height?: number;
}

export function EChart({ option, height = 240 }: EChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (!chartRef.current) {
      chartRef.current = echarts.init(containerRef.current, undefined, { renderer: 'svg' });
    }
    chartRef.current.setOption(option, true);
    chartRef.current.resize();
  }, [option]);

  useEffect(() => {
    const onResize = () => chartRef.current?.resize();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, []);

  return <div ref={containerRef} style={{ width: '100%', height }} />;
}
