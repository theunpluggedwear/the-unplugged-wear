export type TooltipSide = 'top' | 'bottom';

export interface TooltipTriggerRect {
  top: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
}

export interface TooltipPositionOptions {
  trigger: TooltipTriggerRect;
  tooltip: { width: number; height: number };
  viewport: { width: number; height: number };
  
  preferred?: TooltipSide;
  
  offset?: number;
  
  margin?: number;
}

export interface TooltipPosition {
  top: number;
  left: number;
  side: TooltipSide;
}



export function computeTooltipPosition({
  trigger,
  tooltip,
  viewport,
  preferred = 'top',
  offset = 8,
  margin = 8,
}: TooltipPositionOptions): TooltipPosition {
  const order: TooltipSide[] = preferred === 'bottom' ? ['bottom', 'top'] : ['top', 'bottom'];
  let side = order[0];
  let top =
    side === 'top' ? trigger.top - tooltip.height - offset : trigger.bottom + offset;
  const fits =
    side === 'top'
      ? top >= margin
      : top + tooltip.height <= viewport.height - margin;

  if (!fits) {
    side = order[1];
    top =
      side === 'top' ? trigger.top - tooltip.height - offset : trigger.bottom + offset;
  }

  
  top = Math.min(Math.max(top, margin), Math.max(margin, viewport.height - margin - tooltip.height));

  const centered = trigger.left + trigger.width / 2 - tooltip.width / 2;
  const maxLeft = Math.max(margin, viewport.width - margin - tooltip.width);
  const left = Math.min(Math.max(centered, margin), maxLeft);

  return { top, left, side };
}
