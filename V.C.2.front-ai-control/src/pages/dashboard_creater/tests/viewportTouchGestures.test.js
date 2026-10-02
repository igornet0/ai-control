/** @vitest-environment jsdom */

import { describe, expect, it } from 'vitest';
import {
  clampZoom,
  pinchZoomFromDistance,
  pointerDistance,
  pointerMidpoint,
  pointerMovedBeyondTolerance,
  zoomAroundPoint,
  isTouchLikePointer,
  LONG_PRESS_MS,
  POINTER_MOVE_TOLERANCE_PX,
} from '../src/core/viewportTouchGestures.js';

describe('viewportTouchGestures', () => {
  it('computes pointer distance and midpoint', () => {
    expect(pointerDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(pointerMidpoint({ x: 0, y: 10 }, { x: 10, y: 0 })).toEqual({ x: 5, y: 5 });
  });

  it('clamps zoom to the camera range', () => {
    expect(clampZoom(0.01, 0.1, 3)).toBe(0.1);
    expect(clampZoom(9, 0.1, 3)).toBe(3);
    expect(clampZoom(1.2, 0.1, 3)).toBe(1.2);
  });

  it('preserves the workspace point under the pinch center', () => {
    const next = zoomAroundPoint(
      { offsetX: 0, offsetY: 0, zoom: 1 },
      2,
      { x: 100, y: 50 },
    );
    expect(next.zoom).toBe(2);
    expect(next.offsetX).toBe(-100);
    expect(next.offsetY).toBe(-50);
    const workspaceX = (100 - next.offsetX) / next.zoom;
    const workspaceY = (50 - next.offsetY) / next.zoom;
    expect(workspaceX).toBe(100);
    expect(workspaceY).toBe(50);
  });

  it('scales zoom from pinch distances', () => {
    expect(
      pinchZoomFromDistance({
        startDistance: 100,
        currentDistance: 200,
        startZoom: 1,
        minZoom: 0.1,
        maxZoom: 3,
      }),
    ).toBe(2);
    expect(
      pinchZoomFromDistance({
        startDistance: 100,
        currentDistance: 50,
        startZoom: 1,
        minZoom: 0.1,
        maxZoom: 3,
      }),
    ).toBe(0.5);
    expect(
      pinchZoomFromDistance({
        startDistance: 0,
        currentDistance: 80,
        startZoom: 1.4,
        minZoom: 0.1,
        maxZoom: 3,
      }),
    ).toBe(1.4);
  });

  it('detects movement past the long-press slop', () => {
    expect(LONG_PRESS_MS).toBe(400);
    expect(
      pointerMovedBeyondTolerance({ x: 0, y: 0 }, { x: POINTER_MOVE_TOLERANCE_PX, y: 0 }),
    ).toBe(false);
    expect(pointerMovedBeyondTolerance({ x: 0, y: 0 }, { x: POINTER_MOVE_TOLERANCE_PX + 1, y: 0 })).toBe(
      true,
    );
  });

  it('treats touch and pen as touch-like pointers', () => {
    expect(isTouchLikePointer({ pointerType: 'touch' })).toBe(true);
    expect(isTouchLikePointer({ pointerType: 'pen' })).toBe(true);
    expect(isTouchLikePointer({ pointerType: 'mouse' })).toBe(false);
  });
});
