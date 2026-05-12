import { useEffect, useMemo, useRef, useState } from "react";
import { LayoutChangeEvent, StyleSheet, Text, View } from "react-native";
import {
  PanGestureHandler,
  PanGestureHandlerGestureEvent,
  PanGestureHandlerStateChangeEvent,
  PinchGestureHandler,
  PinchGestureHandlerGestureEvent,
  PinchGestureHandlerStateChangeEvent,
  State,
} from "react-native-gesture-handler";
import Svg, { Circle, Line, Polyline, Rect, Text as SvgText } from "react-native-svg";
import { colors } from "../../theme/colors";

type ChartPoint = {
  label: string;
  value: number;
};

type Props = {
  data: ChartPoint[];
  color?: string;
  height?: number;
  emptyText?: string;
  onPinchScale?: (scaleDelta: number, focalX: number, chartWidth: number) => void;
  onPanDelta?: (deltaX: number, chartWidth: number) => void;
};

export const LineChart = ({
  data,
  color = "#2563eb",
  height = 180,
  emptyText = "数据点不足，暂无法绘制折线图",
  onPinchScale,
  onPanDelta,
}: Props) => {
  const [containerWidth, setContainerWidth] = useState(0);
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);
  const pinchRef = useRef<PinchGestureHandler>(null);
  const panRef = useRef<PanGestureHandler>(null);
  const lastPinchScaleRef = useRef(1);
  const lastPanXRef = useRef(0);

  const onLayout = (event: LayoutChangeEvent) => {
    setContainerWidth(Math.floor(event.nativeEvent.layout.width));
  };

  const normalized = useMemo(() => data, [data]);
  const chartWidth = useMemo(
    () => Math.max(containerWidth, 0),
    [containerWidth],
  );
  const canDraw = normalized.length >= 2 && chartWidth > 0;
  useEffect(() => {
    setSelectedPointIndex((prev) => {
      if (prev === null) {
        return prev;
      }
      return prev < normalized.length ? prev : null;
    });
  }, [normalized.length]);

  const chart = useMemo(() => {
    if (!canDraw) {
      return null;
    }
    const paddingLeft = 20;
    const paddingRight = 34;
    const paddingTop = 12;
    const paddingBottom = 24;
    const drawableWidth = chartWidth - paddingLeft - paddingRight;
    const drawableHeight = height - paddingTop - paddingBottom;

    const values = normalized.map((item) => item.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const stepX = normalized.length > 1 ? drawableWidth / (normalized.length - 1) : 0;

    const points = normalized.map((item, index) => {
      const x = paddingLeft + index * stepX;
      const y =
        paddingTop +
        drawableHeight -
        ((item.value - min) / range) * drawableHeight;
      return { ...item, x, y };
    });

    const polyline = points.map((item) => `${item.x},${item.y}`).join(" ");
    return {
      paddingLeft,
      paddingRight,
      paddingTop,
      paddingBottom,
      drawableHeight,
      points,
      polyline,
      min,
      max,
    };
  }, [canDraw, chartWidth, height, normalized]);

  const onPinchGestureEvent = (event: PinchGestureHandlerGestureEvent) => {
    if (!chartWidth) {
      return;
    }
    const scale = event.nativeEvent.scale;
    const delta = scale / lastPinchScaleRef.current;
    lastPinchScaleRef.current = scale;
    if (Number.isFinite(delta) && delta > 0 && Math.abs(delta - 1) > 0.001) {
      onPinchScale?.(delta, event.nativeEvent.focalX, chartWidth);
    }
  };

  const onPinchStateChange = (event: PinchGestureHandlerStateChangeEvent) => {
    const state = event.nativeEvent.state;
    if (state === State.BEGAN) {
      lastPinchScaleRef.current = 1;
      return;
    }
    if (
      state === State.END ||
      state === State.CANCELLED ||
      state === State.FAILED ||
      state === State.UNDETERMINED
    ) {
      lastPinchScaleRef.current = 1;
      return;
    }
    if (event.nativeEvent.oldState !== State.ACTIVE) {
      return;
    }
    lastPinchScaleRef.current = 1;
  };

  const onPanGestureEvent = (event: PanGestureHandlerGestureEvent) => {
    if (!chartWidth) {
      return;
    }
    const x = event.nativeEvent.translationX;
    const deltaX = x - lastPanXRef.current;
    lastPanXRef.current = x;
    if (Math.abs(deltaX) > 0.1) {
      onPanDelta?.(deltaX, chartWidth);
    }
  };

  const onPanStateChange = (event: PanGestureHandlerStateChangeEvent) => {
    const state = event.nativeEvent.state;
    if (state === State.BEGAN) {
      lastPanXRef.current = 0;
      return;
    }
    if (
      state === State.END ||
      state === State.CANCELLED ||
      state === State.FAILED ||
      state === State.UNDETERMINED
    ) {
      lastPanXRef.current = 0;
    }
  };

  const labelStep = useMemo(() => {
    if (!chart || chart.points.length <= 6) {
      return 1;
    }
    return Math.ceil(chart.points.length / 6);
  }, [chart]);
  const labelIndexes = useMemo(() => {
    if (!chart) {
      return [];
    }
    const lastIndex = chart.points.length - 1;
    const indexes: number[] = [];
    for (let i = 0; i <= lastIndex; i += labelStep) {
      indexes.push(i);
    }
    if (indexes[indexes.length - 1] !== lastIndex) {
      indexes.push(lastIndex);
    }
    if (indexes.length >= 2) {
      const minTailGapPx = 28;
      const prevIndex = indexes[indexes.length - 2];
      const tailGap = chart.points[lastIndex].x - chart.points[prevIndex].x;
      if (tailGap < minTailGapPx) {
        indexes.splice(indexes.length - 2, 1);
      }
    }
    return indexes;
  }, [chart, labelStep]);
  const horizontalGuideY = useMemo(() => {
    if (!chart) {
      return [];
    }
    const segments = 4;
    const list: number[] = [];
    for (let i = 1; i < segments; i += 1) {
      list.push(chart.paddingTop + (chart.drawableHeight * i) / segments);
    }
    return list;
  }, [chart]);
  const selectedPoint = useMemo(() => {
    if (!chart || selectedPointIndex === null) {
      return null;
    }
    return chart.points[selectedPointIndex] ?? null;
  }, [chart, selectedPointIndex]);
  const selectedLabel = useMemo(() => {
    if (!selectedPoint) {
      return null;
    }
    return `${selectedPoint.label}  ${selectedPoint.value.toFixed(2)}`;
  }, [selectedPoint]);
  const tooltipLayout = useMemo(() => {
    if (!chart || !selectedPoint || !selectedLabel) {
      return null;
    }
    const width = Math.max(86, selectedLabel.length * 6.2 + 12);
    const heightPx = 20;
    const leftBound = chart.paddingLeft;
    const rightBound = chartWidth - chart.paddingRight;
    const rawX = selectedPoint.x - width / 2;
    const x = Math.min(Math.max(rawX, leftBound), rightBound - width);
    const y = Math.max(2, chart.paddingTop - heightPx - 4);
    return { x, y, width, height: heightPx };
  }, [chart, chartWidth, selectedLabel, selectedPoint]);

  return (
    <View style={styles.wrapper} onLayout={onLayout}>
      {!chart ? (
        <Text style={styles.emptyText}>{emptyText}</Text>
      ) : (
        <PanGestureHandler
          ref={panRef}
          maxPointers={1}
          activeOffsetX={[-8, 8]}
          failOffsetY={[-8, 8]}
          simultaneousHandlers={pinchRef}
          onGestureEvent={onPanGestureEvent}
          onHandlerStateChange={onPanStateChange}
        >
          <View>
            <PinchGestureHandler
              ref={pinchRef}
              simultaneousHandlers={panRef}
              onGestureEvent={onPinchGestureEvent}
              onHandlerStateChange={onPinchStateChange}
            >
              <View>
                <Svg width={chartWidth} height={height}>
                  {horizontalGuideY.map((y, index) => (
                    <Line
                      key={`guide-${index}`}
                      x1={chart.paddingLeft}
                      y1={y}
                      x2={chartWidth - chart.paddingRight}
                      y2={y}
                      stroke="#e2e8f0"
                      strokeWidth={1}
                      strokeDasharray={[3, 3]}
                    />
                  ))}
                  <Line
                    x1={chart.paddingLeft}
                    y1={chart.paddingTop + chart.drawableHeight}
                    x2={chartWidth - chart.paddingRight}
                    y2={chart.paddingTop + chart.drawableHeight}
                    stroke="#cbd5e1"
                    strokeWidth={1}
                  />
                  <Polyline
                    points={chart.polyline}
                    fill="none"
                    stroke={color}
                    strokeWidth={2}
                  />
                  {chart.points.map((item, index) => (
                    <Circle
                      key={`point-${index}`}
                      cx={item.x}
                      cy={item.y}
                      r={selectedPointIndex === index ? 4 : 3}
                      fill={color}
                      onPress={() =>
                        setSelectedPointIndex((prev) => (prev === index ? null : index))
                      }
                    />
                  ))}
                  {labelIndexes.map((index) => {
                    const item = chart.points[index];
                    const isFirst = index === 0;
                    const isLast = index === chart.points.length - 1;
                    return (
                      <SvgText
                        key={`label-${index}`}
                        x={isFirst ? item.x + 2 : isLast ? item.x - 2 : item.x}
                        y={height - 6}
                        fill="#64748b"
                        fontSize={9}
                        textAnchor={isFirst ? "start" : isLast ? "end" : "middle"}
                      >
                        {item.label}
                      </SvgText>
                    );
                  })}
                  {selectedPoint && tooltipLayout && selectedLabel ? (
                    <>
                      <Line
                        x1={selectedPoint.x}
                        y1={chart.paddingTop}
                        x2={selectedPoint.x}
                        y2={chart.paddingTop + chart.drawableHeight}
                        stroke={color}
                        strokeWidth={1}
                        strokeDasharray={[2, 2]}
                        opacity={0.65}
                      />
                      <Rect
                        x={tooltipLayout.x}
                        y={tooltipLayout.y}
                        width={tooltipLayout.width}
                        height={tooltipLayout.height}
                        rx={6}
                        ry={6}
                        fill="#0f172a"
                        opacity={0.9}
                      />
                      <SvgText
                        x={tooltipLayout.x + tooltipLayout.width / 2}
                        y={tooltipLayout.y + 13}
                        fill="#f8fafc"
                        fontSize={9}
                        textAnchor="middle"
                      >
                        {selectedLabel}
                      </SvgText>
                    </>
                  ) : null}
                  <SvgText
                    x={4}
                    y={chart.paddingTop + 8}
                    fill="#94a3b8"
                    fontSize={9}
                    textAnchor="start"
                  >
                    {chart.max.toFixed(1)}
                  </SvgText>
                  <SvgText
                    x={4}
                    y={chart.paddingTop + chart.drawableHeight}
                    fill="#94a3b8"
                    fontSize={9}
                    textAnchor="start"
                  >
                    {chart.min.toFixed(1)}
                  </SvgText>
                </Svg>
              </View>
            </PinchGestureHandler>
          </View>
        </PanGestureHandler>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
    minHeight: 120,
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 13,
    color: colors.textSecondary,
    paddingHorizontal: 8,
    paddingVertical: 14,
  },
});
