export interface WidgetProps {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: string;
}

export abstract class WidgetBase {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: string;

  constructor(props: WidgetProps) {
    this.id = props.id;
    this.x = props.x;
    this.y = props.y;
    this.width = props.width;
    this.height = props.height;
    this.type = props.type;
  }

  abstract draw(ctx: CanvasRenderingContext2D): void;

  isHit(mx: number, my: number): boolean {
    return (
      mx >= this.x &&
      mx <= this.x + this.width &&
      my >= this.y &&
      my <= this.y + this.height
    );
  }
}