import React, { createContext, useCallback, useContext, useEffect, useRef, useState, useId } from "react";
import { Box } from "@mui/material";
import { BLUEPRINT } from "../../theme";

/**
 * Traceability connector system.
 *
 * Represents an FDD requirement -> generated TDD section mapping as a wiring
 * diagram: a thin line with a circular joint at each end, drawn between a
 * "source" node (the requirement) and a "target" node (the generated output),
 * live-computed from their DOM positions. Hovering (or focusing, for keyboard
 * users) either endpoint activates the connector.
 *
 * The mapping itself is always rendered as plain text at both ends — the line
 * is a reinforcing visual, never the only carrier of the relationship.
 */
const Ctx = createContext(null);

export function TraceabilityProvider({ children }) {
  const nodes = useRef(new Map());
  const [activeKey, setActiveKeyState] = useState(null);

  // Note: registration deliberately does NOT trigger a re-render. TraceOverlay
  // reads `nodes` on demand (on activeKey change / scroll / resize), so there's
  // no need to propagate state here — and ref callbacks get fresh identities
  // every render, so doing so would attach/detach/re-render in an infinite loop.
  const register = useCallback((key, el) => {
    if (el) nodes.current.set(key, el);
    else nodes.current.delete(key);
  }, []);

  const getNode = useCallback((key) => nodes.current.get(key), []);
  const getTargets = useCallback((id) => {
    const prefix = `dst:${id}::`;
    const out = [];
    for (const [key, el] of nodes.current.entries()) {
      if (key.startsWith(prefix)) out.push(el);
    }
    return out;
  }, []);
  const setActiveKey = useCallback((key) => setActiveKeyState(key), []);

  return (
    <Ctx.Provider value={{ register, getNode, getTargets, activeKey, setActiveKey }}>
      {children}
    </Ctx.Provider>
  );
}

function useTraceability() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("Traceability components must be used within a TraceabilityProvider");
  return ctx;
}

/** Wraps a requirement (the source of a mapping). Hover/focus activates its connector. */
export function TraceSource({ id, children, sx, ...props }) {
  const { register, setActiveKey, activeKey } = useTraceability();
  const isActive = activeKey === id;
  const refCallback = useCallback((el) => register(`src:${id}`, el), [register, id]);
  return (
    <Box
      ref={refCallback}
      onMouseEnter={() => setActiveKey(id)}
      onMouseLeave={() => setActiveKey(null)}
      onFocus={() => setActiveKey(id)}
      onBlur={() => setActiveKey(null)}
      tabIndex={0}
      role="button"
      sx={{
        cursor: "default",
        outlineOffset: 2,
        transition: "background-color 0.15s ease",
        backgroundColor: isActive ? "rgba(44,95,124,0.06)" : "transparent",
        ...sx,
      }}
      {...props}
    >
      {children}
    </Box>
  );
}

/**
 * Wraps a piece of generated output (a target of a mapping). Multiple
 * TraceTarget instances may share the same `id` — e.g. every API/table/
 * component chip linked from one FDD requirement — and all of them light up
 * and grow a connector line back to the shared source.
 */
export function TraceTarget({ id, children, sx, ...props }) {
  const { register, activeKey } = useTraceability();
  const instanceId = useId();
  const isActive = activeKey === id;
  const refCallback = useCallback((el) => register(`dst:${id}::${instanceId}`, el), [register, id, instanceId]);
  return (
    <Box
      ref={refCallback}
      sx={{
        transition: "background-color 0.15s ease",
        backgroundColor: isActive ? "rgba(44,95,124,0.06)" : "transparent",
        ...sx,
      }}
      {...props}
    >
      {children}
    </Box>
  );
}

/** Small circular joint marker, rendered inline at connector endpoints for legibility. */
export function TraceJoint({ sx }) {
  return (
    <Box
      aria-hidden="true"
      sx={{
        display: "inline-block",
        width: 7,
        height: 7,
        borderRadius: "50%",
        border: `1.5px solid ${BLUEPRINT.steel}`,
        backgroundColor: "#FFFFFF",
        flexShrink: 0,
        ...sx,
      }}
    />
  );
}

/**
 * Absolutely-positioned SVG overlay that draws the live connector line.
 * Mount once inside a `position: relative` container that encloses both the
 * TraceSource and TraceTarget nodes for a given screen.
 */
export function TraceOverlay({ containerRef }) {
  const { activeKey, getNode, getTargets } = useTraceability();
  const [lines, setLines] = useState([]);

  useEffect(() => {
    function compute() {
      if (!activeKey || !containerRef.current) {
        setLines([]);
        return;
      }
      const srcEl = getNode(`src:${activeKey}`);
      const dstEls = getTargets(activeKey);
      if (!srcEl || dstEls.length === 0) {
        setLines([]);
        return;
      }
      const cRect = containerRef.current.getBoundingClientRect();
      const sRect = srcEl.getBoundingClientRect();

      const next = dstEls.map((dstEl) => {
        const dRect = dstEl.getBoundingClientRect();
        const sOnLeft = sRect.left <= dRect.left;
        const x1 = (sOnLeft ? sRect.right : sRect.left) - cRect.left;
        const y1 = sRect.top + sRect.height / 2 - cRect.top;
        const x2 = (sOnLeft ? dRect.left : dRect.right) - cRect.left;
        const y2 = dRect.top + dRect.height / 2 - cRect.top;
        return { x1, y1, x2, y2 };
      });
      setLines(next);
    }
    compute();
    const onScroll = () => compute();
    const onResize = () => compute();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [activeKey, getNode, getTargets, containerRef]);

  if (lines.length === 0) return null;

  return (
    <Box
      aria-hidden="true"
      sx={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 20 }}
    >
      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        {lines.map((line, i) => {
          const midX = (line.x1 + line.x2) / 2;
          return (
            <g key={i}>
              <path
                d={`M ${line.x1} ${line.y1} C ${midX} ${line.y1}, ${midX} ${line.y2}, ${line.x2} ${line.y2}`}
                fill="none"
                stroke={BLUEPRINT.steel}
                strokeWidth="1.5"
              />
              <circle cx={line.x1} cy={line.y1} r="4" fill="#FFFFFF" stroke={BLUEPRINT.steel} strokeWidth="1.5" />
              <circle cx={line.x2} cy={line.y2} r="4" fill="#FFFFFF" stroke={BLUEPRINT.steel} strokeWidth="1.5" />
            </g>
          );
        })}
      </svg>
    </Box>
  );
}
