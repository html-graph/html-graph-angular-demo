import {
  ApplicationRef,
  createComponent,
  inject,
  Injectable,
  Injector,
  inputBinding,
  outputBinding,
  signal,
  ViewRef,
} from '@angular/core';
import { Canvas, CanvasBuilder, Identifier } from '@html-graph/html-graph';
import { GraphNodeShape } from './graph-node-shape';
import graphData from './graph.json';

@Injectable()
export class CanvasAdapter {
  private readonly appRef = inject(ApplicationRef);

  private readonly injector = inject(Injector);

  private canvas!: Canvas;

  private readonly viewRefs = new Map<Identifier, ViewRef>();

  private readonly outgoingNodeIds = new Map<Identifier, Set<Identifier>>();

  private readonly minContentScale = 0.3;

  private readonly expandedNodes = signal<ReadonlySet<Identifier>>(new Set<Identifier>());

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
          animationDuration: 200,
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

    this.canvas.graph.onBeforeNodeRemoved.subscribe((nodeId) => {
      const viewRef = this.viewRefs.get(nodeId)!;

      viewRef.destroy();

      this.viewRefs.delete(nodeId);
    });

    this.canvas.graph.onBeforeClear.subscribe(() => {
      this.reset();
    });

    this.canvas.onBeforeDestroy.subscribe(() => {
      this.reset();
    });

    this.canvas.center({ x: 0, y: 0 });
    this.addNode(0);
    this.expandNode(0);
  }

  destroy(): void {
    this.canvas.destroy();
  }

  private addNode(nodeId: Identifier): void {
    const nodeElement = document.createElement('div');

    const nodeComponent = createComponent(GraphNodeShape, {
      environmentInjector: this.appRef.injector,
      hostElement: nodeElement,
      elementInjector: this.injector,
      bindings: [
        inputBinding('nodeId', () => nodeId),
        inputBinding('name', () => `Node ${nodeId}`),
        inputBinding('expanded', () => this.expandedNodes().has(nodeId)),
        inputBinding('hasChildren', () => this.outgoingNodeIds.get(nodeId) !== undefined),
        outputBinding('afterInitialized', () => {
          this.canvas.updateNode(nodeId);
        }),
        outputBinding('expandTriggered', () => {
          this.expandChildNode(nodeId);
        }),
        outputBinding('collapseTriggered', () => {
          this.collapseChildrenRecursive(nodeId);
        }),
      ],
    });

    const { hostView, instance } = nodeComponent;
    this.viewRefs.set(nodeId, hostView);

    this.appRef.attachView(hostView);

    this.canvas.addNode({
      id: nodeId,
      element: nodeElement,
      ports: [
        { id: `port-${nodeId}-in`, element: instance.portIn.nativeElement },
        { id: `port-${nodeId}-out`, element: instance.portOut.nativeElement },
      ],
    });
  }

  private expandChildNode(nodeId: Identifier): void {
    const childNodeIds = this.expandNode(nodeId);

    this.canvas.focus(childNodeIds);
  }

  private expandNode(nodeId: Identifier): Iterable<Identifier> {
    const childNodeIds = this.outgoingNodeIds.get(nodeId)!;
    const focusNodes: Identifier[] = [];

    childNodeIds.forEach((childNodeId) => {
      if (!this.canvas.graph.hasNode(childNodeId)) {
        this.addNode(childNodeId);
      }

      focusNodes.push(childNodeId);

      this.canvas.addEdge({ from: `port-${nodeId}-out`, to: `port-${childNodeId}-in` });
    });

    const expandedNodes = this.expandedNodes();

    const newExpandedNodes = new Set(expandedNodes);
    newExpandedNodes.add(nodeId);

    this.expandedNodes.set(newExpandedNodes);

    return childNodeIds;
  }

  private collapseChildrenRecursive(nodeId: Identifier): void {
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

    const expandedNodes = this.expandedNodes();
    const newExpandedNodes = new Set(expandedNodes);

    nodesToRemove.forEach((removeNodeId) => {
      this.canvas.removeNode(removeNodeId);

      newExpandedNodes.delete(removeNodeId);
    });

    newExpandedNodes.delete(nodeId);

    this.expandedNodes.set(newExpandedNodes);

    this.canvas.focus([nodeId]);
  }

  private reset(): void {
    this.viewRefs.forEach((viewRef) => {
      viewRef.destroy();
    });

    this.viewRefs.clear();
  }
}
