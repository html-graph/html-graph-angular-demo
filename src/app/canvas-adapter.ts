import {
  ApplicationRef,
  createComponent,
  inject,
  Injectable,
  Injector,
  inputBinding,
  outputBinding,
  ViewRef,
} from '@angular/core';
import { Canvas, CanvasBuilder, Identifier } from '@html-graph/html-graph';
import { GraphNode } from './graph-node';
import graphData from './graph.json';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable()
export class CanvasAdapter {
  private readonly outgoingNodeIds = new Map<Identifier, Set<Identifier>>();

  private canvas!: Canvas;

  private readonly appRef = inject(ApplicationRef);

  private readonly injector = inject(Injector);

  private readonly expandedNodesInternal$ = new BehaviorSubject<Set<Identifier>>(new Set());

  readonly expandedNodes$: Observable<ReadonlySet<Identifier>> =
    this.expandedNodesInternal$.asObservable();

  private readonly minContentScale = 0.3;

  private readonly viewRefs = new Map<Identifier, ViewRef>();

  init(element: HTMLElement): void {
    graphData.edges.forEach((edge) => {
      const edges = this.outgoingNodeIds.get(edge.from);

      if (edges !== undefined) {
        edges.add(edge.to);
      } else {
        this.outgoingNodeIds.set(edge.from, new Set([edge.to]));
      }
    });

    this.canvas = new CanvasBuilder(element)
      .setDefaults({
        nodes: {
          priority: 1,
        },
        edges: {
          priority: 0,
          shape: {
            curvature: 250,
            hasTargetArrow: true,
          },
        },
        focus: {
          minContentScale: this.minContentScale,
        },
      })
      .enableUserTransformableViewport({
        transformPreprocessor: {
          type: 'scale-limit',
          minContentScale: this.minContentScale,
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
          vertical: 25,
        },
      })
      .build();

    this.addNode(0);
    this.expandNode(0);

    this.canvas.focus();
  }

  renderNode(nodeId: Identifier): void {
    this.canvas.updateNode(nodeId);
  }

  expandNode(nodeId: Identifier): void {
    const childNodeIds = this.outgoingNodeIds.get(nodeId);
    const focusNodes: Identifier[] = [];

    if (childNodeIds !== undefined) {
      childNodeIds.forEach((childNodeId) => {
        if (!this.canvas.graph.hasNode(childNodeId)) {
          this.addNode(childNodeId);
        }

        focusNodes.push(childNodeId);

        this.canvas.addEdge({ from: `port-${nodeId}-out`, to: `port-${childNodeId}-in` });
      });
    }

    if (focusNodes.length > 0) {
      this.canvas.focus(focusNodes);
    }

    const expandedNodes = this.expandedNodesInternal$.getValue();

    const newExpandedNodes = new Set(expandedNodes);
    newExpandedNodes.add(nodeId);

    this.expandedNodesInternal$.next(newExpandedNodes);
  }

  collapseNode(nodeId: number): void {
    const nodesToRemove = new Set<Identifier>();

    const stack: Identifier[] = [nodeId];

    while (stack.length > 0) {
      const currentNodeId = stack.pop()!;

      const childNodeIds = this.canvas.graph.getNodeOutgoingEdgeIds(currentNodeId).map((edgeId) => {
        const edge = this.canvas.graph.getEdge(edgeId);
        const port = this.canvas.graph.getPort(edge.to);

        return port.nodeId;
      });

      childNodeIds.forEach((childId) => {
        if (!nodesToRemove.has(childId)) {
          stack.push(childId);
          nodesToRemove.add(childId);
        }
      });
    }

    const expandedNodes = this.expandedNodesInternal$.getValue();
    const newExpandedNodes = new Set(expandedNodes);

    nodesToRemove.forEach((removeNodeId) => {
      const hostView = this.viewRefs.get(removeNodeId)!;
      this.viewRefs.delete(removeNodeId);

      this.canvas.removeNode(removeNodeId);
      hostView.destroy();

      newExpandedNodes.delete(removeNodeId);
    });

    newExpandedNodes.delete(nodeId);

    this.expandedNodesInternal$.next(newExpandedNodes);

    this.canvas.focus([nodeId]);
  }

  hasChildren(nodeId: Identifier): boolean {
    return this.outgoingNodeIds.has(nodeId);
  }

  destroy(): void {
    this.canvas.destroy();
  }

  private addNode(id: Identifier): void {
    const nodeElement = document.createElement('div');
    const nodeComponent = createComponent(GraphNode, {
      environmentInjector: this.appRef.injector,
      hostElement: nodeElement,
      elementInjector: this.injector,
      bindings: [
        inputBinding('id', () => id),
        inputBinding('name', () => `Node ${id}`),
        outputBinding('afterInitialized', () => {
          this.canvas.updateNode(id);
        }),
      ],
    });

    const { hostView, instance } = nodeComponent;
    this.viewRefs.set(id, hostView);

    this.appRef.attachView(hostView);

    this.canvas.addNode({
      id,
      element: nodeElement,
      ports: [
        { id: `port-${id}-in`, element: instance.portIn.nativeElement },
        { id: `port-${id}-out`, element: instance.portOut.nativeElement },
      ],
    });
  }
}
