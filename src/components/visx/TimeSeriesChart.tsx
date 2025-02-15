import React, { useEffect, useMemo, useState } from 'react';

import { LinearGradient } from '@visx/gradient';
import { ParentSize } from '@visx/responsive';
import type { ScaleConfig } from '@visx/scale';
import {
  XYChart,
  Axis,
  Grid,
  DataProvider,
  EventEmitterProvider,
  LineSeries,
  GlyphSeries,
  type Margin,
  type AxisScale,
  type TooltipContextType,
} from '@visx/xychart';
import { RenderTooltipParams } from '@visx/xychart/lib/components/Tooltip';
import styled, { AnyStyledComponent, keyframes } from 'styled-components';

import { allTimeUnits } from '@/constants/time';

import { useBreakpoints } from '@/hooks';
import { useAnimationFrame } from '@/hooks/useAnimationFrame';

import { layoutMixins } from '@/styles/layoutMixins';

import Tooltip from '@/components/visx/XYChartTooltipWithBounds';

import { formatAbsoluteTime } from '@/lib/dateTime';
import { clamp, lerp, map } from '@/lib/math';
import { objectEntries } from '@/lib/objectEntries';

import { XYChartThreshold, type Threshold } from './XYChartThreshold';

type LineSeriesProps<Datum extends {}> = Parameters<
  typeof LineSeries<AxisScale, AxisScale, Datum>
>[0];

type GlyphSeriesProps<Datum extends {} = {}> = Parameters<
  typeof GlyphSeries<AxisScale, AxisScale, Datum>
>[0];

type ThresholdProps<Datum extends {} = {}> = Parameters<typeof Threshold<Datum>>[0];

type ElementProps<Datum extends {}> = {
  id: string;
  selectedLocale: string;
  yAxisScaleType?: ScaleConfig['type'];
  data: Datum[];
  series: (Pick<
    LineSeriesProps<Datum>,
    | 'dataKey'
    // | 'xAccessor'
    // | 'yAccessor'
    | 'colorAccessor'
    // | 'curve'
    | 'onPointerMove'
    | 'onPointerOut'
  > &
    Pick<ThresholdProps<Datum>, 'curve'> & {
      colorAccessor: GlyphSeriesProps<Datum>['colorAccessor'];
      xAccessor: (_: Datum) => number;
      yAccessor: (_: Datum) => number;
      getCurve?: (_: { zoom: number; zoomDomain: number }) => ThresholdProps<Datum>['curve']; // LineSeriesProps<Datum>['curve'];
      glyphSize?: GlyphSeriesProps<Datum>['size'];
      getGlyphSize?: (_: { datum: Datum; zoom: number }) => number;
      threshold?: Pick<ThresholdProps<Datum>, 'aboveAreaProps' | 'belowAreaProps'> & {
        yAccessor: LineSeriesProps<Datum>['yAccessor'];
      };
    })[];
  tickFormatX?: (x: number, _: { zoom: number; zoomDomain: number; numTicks: number }) => string;
  tickFormatY?: (y: number, _: { zoom: number; zoomDomain: number; numTicks: number }) => string;
  renderXAxisLabel?: (_: RenderTooltipParams<Datum>) => React.ReactNode;
  renderYAxisLabel?: (_: RenderTooltipParams<Datum>) => React.ReactNode;
  renderTooltip?: (_: RenderTooltipParams<Datum>) => React.ReactNode;
  onTooltipContext?: (tooltipContext: TooltipContextType<Datum>) => void;
  onVisibleDataChange?: (data: Datum[]) => void;
  onZoom?: (_: { zoomDomain: number | undefined }) => void;
  slotEmpty: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

type StyleProps = {
  margin?: Margin;
  padding?: Margin;
  defaultZoomDomain?: number;
  minZoomDomain: number;
  numGridLines?: number;
  withGridRows?: boolean;
  withGridColumns?: boolean;
  tickSpacingX?: number;
  tickSpacingY?: number;
};

export const TimeSeriesChart = <Datum extends {}>({
  id,
  selectedLocale,
  yAxisScaleType = 'linear',
  data,
  series,
  tickFormatX = (timestamp, { zoomDomain, numTicks }) =>
    formatAbsoluteTime(timestamp, {
      resolutionUnit:
        objectEntries(allTimeUnits)
          .sort((a, b) => a[1] - b[1])
          .find(([, milliseconds]) => zoomDomain <= milliseconds)?.[0] ?? 'year',
      locale: selectedLocale,
    }),
  tickFormatY = (y) => String(y),
  renderXAxisLabel,
  renderYAxisLabel,
  renderTooltip,
  onTooltipContext,
  onVisibleDataChange,
  onZoom,
  slotEmpty,
  children,
  className,

  margin,
  padding,
  defaultZoomDomain,
  minZoomDomain = 0,
  numGridLines,
  withGridRows = true,
  withGridColumns = false,
  tickSpacingX = 150,
  tickSpacingY = 50,
}: ElementProps<Datum> & StyleProps) => {
  // Context
  const { isMobile } = useBreakpoints();

  // Chart data
  const { xAccessor, yAccessor } = series[0];

  const earliestDatum = data?.[0];
  const latestDatum = data?.[data.length - 1];

  // Chart state
  const [zoomDomain, setZoomDomain] = useState<number | undefined>(
    defaultZoomDomain ?? xAccessor(latestDatum) - xAccessor(earliestDatum)
  );

  const [zoomDomainAnimateTo, setZoomDomainAnimateTo] = useState<number | undefined>();

  useEffect(() => {
    if (defaultZoomDomain && defaultZoomDomain !== zoomDomain) {
      setZoomDomainAnimateTo(defaultZoomDomain);
    }
  }, [defaultZoomDomain]);

  useEffect(() => {
    onZoom?.({ zoomDomain });
  }, [zoomDomain]);

  useAnimationFrame(
    (elapsedMilliseconds) => {
      if (zoomDomainAnimateTo) {
        setZoomDomain(
          (zoomDomain) =>
            zoomDomain &&
            zoomDomain * (zoomDomainAnimateTo / zoomDomain) ** (elapsedMilliseconds * 0.0166)
        );
      }
    },
    [zoomDomainAnimateTo]
  );

  // Computations
  const { zoom, domain, range, visibleData } = useMemo(() => {
    if (!zoomDomain) return {};

    const zoom = zoomDomain / minZoomDomain;

    const domain = [
      clamp(xAccessor(latestDatum) - zoomDomain, xAccessor(earliestDatum), xAccessor(latestDatum)),
      xAccessor(latestDatum),
    ] as const;

    const visibleData = data.filter(
      (datum) => xAccessor(datum) >= domain[0] && xAccessor(datum) <= domain[1]
    );

    const range = visibleData
      .filter((datum) => xAccessor(datum) >= domain[0] && xAccessor(datum) <= domain[1])
      .map((datum) => yAccessor(datum))
      .reduce((range, y) => [Math.min(range[0], y), Math.max(range[1], y)] as const, [
        Infinity,
        -Infinity,
      ] as const);

    return { zoom, domain, range, visibleData };
  }, [data, zoomDomain, minZoomDomain]);

  useEffect(() => {
    if (visibleData) {
      onVisibleDataChange?.(visibleData);
    }
  }, [visibleData]);

  // Events
  const onWheel = ({ deltaX, deltaY }: WheelEvent) => {
    setZoomDomain(
      clamp(
        Math.max(1e-320, Math.min(Number.MAX_SAFE_INTEGER, zoomDomain * Math.exp(deltaY / 1000))),
        minZoomDomain,
        xAccessor(latestDatum) - xAccessor(earliestDatum)
      )
    );

    setZoomDomainAnimateTo(undefined);

    // TODO: scroll horizontally to pan
  };

  return (
    <Styled.Container onWheel={onWheel} className={className}>
      {data.length && zoomDomain ? (
        <DataProvider
          xScale={{
            type: 'time', // 'linear'
            clamp: false,
            nice: false,
            zero: false,
            domain: [
              lerp(0 - (padding?.left ?? 0), ...domain),
              lerp(1 + (padding?.right ?? 0), ...domain),
            ],
          }}
          yScale={{
            type: yAxisScaleType,
            clamp: true,
            nice: true,
            zero: false,
            domain: [
              lerp(0 - (padding?.bottom ?? 0.05), ...range),
              lerp(1 + (padding?.top ?? 0.05), ...range),
            ],
          }}
        >
          <EventEmitterProvider>
            <Styled.ParentSize>
              {({ width, height }: { width: number; height: number }) => {
                const numTicksX =
                  (width - (margin?.left ?? 0) - (margin?.right ?? 0)) / tickSpacingX;
                const numTicksY =
                  (height - (margin?.top ?? 0) - (margin?.bottom ?? 0)) / tickSpacingY;

                return (
                  <XYChart margin={margin} width={width} height={height}>
                    <Grid
                      numTicks={numGridLines !== undefined ? numGridLines : numTicksY}
                      rows={withGridRows}
                      columns={withGridColumns}
                      lineStyle={{
                        stroke: 'var(--color-border)',
                        strokeWidth: 'var(--border-width)',
                        strokeDasharray: '4',
                      }}
                    />

                    {series.map((series) => (
                      <React.Fragment key={series.dataKey}>
                        {series.threshold && (
                          <>
                            <XYChartThreshold<Datum>
                              id={`${Math.random()}`}
                              data={data}
                              x={series.xAccessor}
                              y0={series.yAccessor}
                              y1={series.threshold.yAccessor}
                              clipAboveTo={margin?.top ?? 0}
                              clipBelowTo={height - (margin?.bottom ?? 0)}
                              curve={series.getCurve?.({ zoom, zoomDomain }) ?? series.curve}
                              aboveAreaProps={{
                                fill: 'url(#XYChartThresholdAbove)',
                                fillOpacity: series.threshold.aboveAreaProps?.fillOpacity,
                                strokeWidth: series.threshold.aboveAreaProps?.strokeWidth,
                                stroke: series.threshold.aboveAreaProps?.stroke,
                              }}
                              belowAreaProps={{
                                fill: 'url(#XYChartThresholdBelow)',
                                fillOpacity: series.threshold.belowAreaProps?.fillOpacity,
                                strokeWidth: series.threshold.belowAreaProps?.strokeWidth,
                                stroke: series.threshold.belowAreaProps?.stroke,
                              }}
                            />
                            <LinearGradient
                              id="XYChartThresholdAbove"
                              from={series.threshold.aboveAreaProps?.fill}
                              to={series.threshold.aboveAreaProps?.fill}
                              toOpacity={series.threshold.aboveAreaProps?.fillOpacity}
                              toOffset={`${map(0, range[0], range[1], 100, 0)}%`}
                            />
                            <LinearGradient
                              id="XYChartThresholdBelow"
                              from={series.threshold.belowAreaProps?.fill}
                              fromOpacity={series.threshold.aboveAreaProps?.fillOpacity}
                              to={series.threshold.belowAreaProps?.fill}
                              fromOffset={`${map(0, range[0], range[1], 100, 0)}%`}
                            />
                          </>
                        )}
                        <LineSeries
                          dataKey={`LineSeries-${series.dataKey}`}
                          data={data}
                          xAccessor={series.xAccessor}
                          yAccessor={series.yAccessor}
                          curve={series.getCurve?.({ zoom, zoomDomain }) ?? series.curve}
                          colorAccessor={
                            series.threshold ? () => 'transparent' : series.colorAccessor
                          }
                          onPointerMove={series?.onPointerMove}
                          onPointerOut={series?.onPointerOut}
                        />

                        {(series.glyphSize || series.getGlyphSize) && (
                          <GlyphSeries
                            dataKey={`GlyphSeries-${series.dataKey}`}
                            data={data}
                            xAccessor={series.xAccessor}
                            yAccessor={series.yAccessor}
                            colorAccessor={series.colorAccessor}
                            size={
                              series.getGlyphSize
                                ? (datum) => series.getGlyphSize?.({ datum, zoom }) || 0
                                : series.glyphSize || 0
                            }
                          />
                        )}
                      </React.Fragment>
                    ))}

                    {/* Y-Axis */}
                    {!isMobile && (
                      <>
                        {margin?.left && margin.left > 0 && (
                          <Styled.YAxisBackground x="0" y="0" width={margin.left} height="100%" />
                        )}

                        <Axis
                          orientation="left"
                          numTicks={numTicksY}
                          // hideAxisLine
                          stroke="var(--color-border)"
                          // hideTicks
                          tickStroke="var(--color-border)"
                          tickFormat={(y) =>
                            tickFormatY(y, { zoom, zoomDomain, numTicks: numTicksY })
                          }
                        />
                      </>
                    )}

                    {/* X-Axis */}
                    <Axis
                      orientation="bottom"
                      numTicks={numTicksX}
                      stroke="var(--color-border)"
                      strokeWidth={1}
                      tickStroke="var(--color-border)"
                      tickFormat={(x) => tickFormatX(x, { zoom, zoomDomain, numTicks: numTicksX })}
                    />

                    {renderTooltip && (
                      <Tooltip<Datum>
                        unstyled
                        applyPositionStyle
                        showDatumGlyph
                        glyphStyle={{
                          fill: 'var(--color-text-1)',
                          stroke: 'var(--color-layer-5)',
                          radius: 4,
                        }}
                        showVerticalCrosshair
                        verticalCrosshairStyle={{
                          strokeWidth: 1,
                          strokeDasharray: '5 5',
                          opacity: 0.7,
                        }}
                        snapCrosshairToDatumX
                        renderXAxisLabel={renderXAxisLabel}
                        showHorizontalCrosshair
                        horizontalCrosshairStyle={{
                          strokeWidth: 1,
                          strokeDasharray: '5 5',
                          opacity: 0.7,
                        }}
                        snapCrosshairToDatumY
                        renderYAxisLabel={renderYAxisLabel}
                        snapTooltipToDatumX
                        snapTooltipToDatumY={false}
                        renderTooltip={renderTooltip}
                        onTooltipContext={onTooltipContext}
                      />
                    )}
                  </XYChart>
                );
              }}
            </Styled.ParentSize>
          </EventEmitterProvider>
        </DataProvider>
      ) : (
        slotEmpty ?? null
      )}

      {children}
    </Styled.Container>
  );
};

const Styled: Record<string, AnyStyledComponent> = {};

Styled.Container = styled.div`
  ${layoutMixins.stack}
  width: 0;
  min-width: 100%;
  height: 0;
  min-height: 100%;

  background: var(--stickyArea-background);

  font-size: 0.75rem;

  transform-style: flat;

  cursor: crosshair;
  user-select: none;

  text {
    font-feature-settings: var(--fontFeature-monoNumbers);
    fill: var(--color-text-0);
  }

  @media (prefers-reduced-motion: no-preference) {
    g[data-state='open'] {
      animation: ${keyframes`
        from {
          opacity: 0;
        }
      `} 0.1s var(--ease-out-expo);
    }
    &:not(:hover) g[data-state] {
      animation: ${keyframes`
        to {
          opacity: 0;
        }
      `} 0.2s 0.3s var(--ease-out-expo) forwards;
    }
  }
`;

Styled.ParentSize = styled(ParentSize)`
  min-height: 0;
  display: grid;

  overflow: auto;
  overscroll-behavior: contain;
`;

Styled.YAxisBackground = styled.foreignObject`
  background: var(--stickyArea-background);

  /* Safari */
  @supports (background: -webkit-named-image(i)) {
    background: var(--stickyArea-background);
  }
`;
