import {
  ApplicationRef,
  createComponent,
  inject,
  Injectable,
  Injector,
  inputBinding,
} from '@angular/core';
import { Canvas, CanvasBuilder } from '@html-graph/html-graph';
import { GraphNode } from './graph-node';

@Injectable()
export class AppStore {
  private element!: HTMLElement;

  private canvas!: Canvas;

  private readonly appRef = inject(ApplicationRef);

  private readonly injector = inject(Injector);

  private currentNodeId = 0;

  init(element: HTMLElement): void {
    this.element = element;
    this.canvas = new CanvasBuilder(this.element)
      .setDefaults({
        nodes: {
          priority: 1,
        },
        edges: {
          priority: 0,
          shape: {
            curvature: 250,
          },
        },
      })
      .enableUserTransformableViewport({
        transformPreprocessor: {
          type: 'scale-limit',
          minContentScale: 0.3,
        },
      })
      .enableBackground()
      .enableLayout({
        algorithm: {
          type: 'hierarchical',
          layerWidth: 700,
        },
      })
      .enableVirtualScroll({
        nodeContainingRadius: {
          horizontal: 250,
          vertical: 5,
        },
      })
      .build();

    this.addNode(this.createNextId());

    this.canvas.focus();
  }

  addChildren(nodeId: number): void {
    const size = Math.floor(Math.random() * 20);

    for (let i = 0; i < size; i++) {
      const childNodeId = this.createNextId();
      this.addNode(childNodeId);
      this.canvas.addEdge({ from: `port-${nodeId}-out`, to: `port-${childNodeId}-in` });
    }

    console.log(nodeId);
  }

  destroy(): void {
    this.canvas.destroy();
  }

  private addNode(id: number): void {
    const nodeElement = document.createElement('div');
    const nodeComponent = createComponent(GraphNode, {
      environmentInjector: this.appRef.injector,
      hostElement: nodeElement,
      elementInjector: this.injector,
      bindings: [inputBinding('id', () => id), inputBinding('name', () => `Node ${id}`)],
    });

    this.appRef.attachView(nodeComponent.hostView);

    this.canvas.addNode({
      id,
      element: nodeElement,
      ports: [
        { id: `port-${id}-in`, element: nodeComponent.instance.portIn.nativeElement },
        { id: `port-${id}-out`, element: nodeComponent.instance.portOut.nativeElement },
      ],
    });
  }

  private createNextId(): number {
    return this.currentNodeId++;
  }
}
