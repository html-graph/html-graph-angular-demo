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

  /** Stores Angular component views to properly clean them up when nodes are removed */
  private readonly viewRefs = new Map<Identifier, ViewRef>();

  /** Represents the graph structure: maps each node ID to its child node IDs */
  private readonly outgoingNodeIds = new Map<Identifier, Set<Identifier>>();

  /** Minimum allowed zoom level to prevent excessive zoom-out */
  private readonly minContentScale = 0.3;

  /**
   * Tracks which nodes are currently expanded in the tree view.
   * Using signal for reactivity to update node components when expansion state changes
   */
  private readonly expandedNodes = signal<ReadonlySet<Identifier>>(new Set<Identifier>());

  init(element: HTMLElement): void {
    // Build the graph structure from imported JSON data
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
          priority: 1, // Nodes appear above edges
        },
        edges: {
          priority: 0, // Edges appear below nodes
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
          minContentScale: this.minContentScale, // Prevent zooming beyond minimum scale
        },
      })
      .enableBackground()
      .enableLayout({
        algorithm: {
          type: 'hierarchical',
          layerWidth: 700, // Horizontal spacing between hierarchy levels
        },
      })
      .enableVirtualScroll({
        nodeContainingRadius: {
          horizontal: 250,
          vertical: 25,
        },
      })
      .build();

    // Clean up Angular component when a node is removed
    this.canvas.graph.onBeforeNodeRemoved.subscribe((nodeId) => {
      const viewRef = this.viewRefs.get(nodeId)!;

      // Must manually detach view to prevent memory leak
      viewRef.destroy();
      this.viewRefs.delete(nodeId);
    });

    // Clean up all Angular components when the entire graph is cleared
    this.canvas.graph.onBeforeClear.subscribe(() => {
      this.reset();
      this.expandedNodes.set(new Set());
    });

    // Clean up when the canvas itself is destroyed
    this.canvas.onBeforeDestroy.subscribe(() => {
      this.reset();
    });

    // Start with root node centered in viewport
    this.canvas.center({ x: 0, y: 0 });
    this.addNode(0);
    this.expandNode(0);
  }

  destroy(): void {
    this.canvas.destroy();
  }

  /**
   * Creates and adds a new node to the graph
   * The node is an Angular component that becomes fully interactive within the canvas
   */
  private addNode(nodeId: Identifier): void {
    const nodeElement = document.createElement('div');

    const nodeComponent = createComponent(GraphNodeShape, {
      environmentInjector: this.appRef.injector,
      hostElement: nodeElement,
      elementInjector: this.injector,
      bindings: [
        inputBinding('nodeId', () => nodeId),
        inputBinding('name', () => `Node ${nodeId}`),
        // Reactive binding using signal - component updates when expansion state changes
        inputBinding('expanded', () => this.expandedNodes().has(nodeId)),
        inputBinding('hasChildren', () => this.outgoingNodeIds.get(nodeId) !== undefined),
        // Notify canvas that node is ready after Angular lifecycle completes
        outputBinding('afterInitialized', () => {
          this.canvas.updateNode(nodeId);
        }),
        // Handle user click on expand/collapse button
        outputBinding('expandTriggered', () => {
          this.expandChildNode(nodeId);
        }),
        outputBinding('collapseTriggered', () => {
          this.collapseChildrenRecursive(nodeId);
        }),
      ],
    });

    const { hostView, instance } = nodeComponent;

    // Store view for later cleanup
    this.viewRefs.set(nodeId, hostView);

    // Attach to Angular's change detection system
    this.appRef.attachView(hostView);

    this.canvas.addNode({
      id: nodeId,
      element: nodeElement,
      ports: [
        { id: `${nodeId}-in`, element: instance.portIn.nativeElement },
        { id: `${nodeId}-out`, element: instance.portOut.nativeElement },
      ],
    });
  }

  /** Expands a node and focuses the viewport on its children */
  private expandChildNode(nodeId: Identifier): void {
    const childNodeIds = this.expandNode(nodeId);

    this.canvas.focus(childNodeIds);
  }

  /**
   * Expands a node by creating all its child nodes and connecting edges
   * Returns the set of child node IDs that were created
   */
  private expandNode(nodeId: Identifier): Iterable<Identifier> {
    const childNodeIds = this.outgoingNodeIds.get(nodeId)!;
    const focusNodes: Identifier[] = [];

    childNodeIds.forEach((childNodeId) => {
      this.addNode(childNodeId);

      focusNodes.push(childNodeId);

      // Connect from this node's output port to child's input port
      this.canvas.addEdge({ from: `${nodeId}-out`, to: `${childNodeId}-in` });
    });

    const expandedNodes = this.expandedNodes();
    const newExpandedNodes = new Set(expandedNodes);
    newExpandedNodes.add(nodeId);
    this.expandedNodes.set(newExpandedNodes);

    return childNodeIds;
  }

  /**
   * Collapses a node and recursively removes all its descendants from the graph
   */
  private collapseChildrenRecursive(nodeId: Identifier): void {
    const nodesToRemove = new Set<Identifier>();
    const stack: Identifier[] = [nodeId];

    // Depth-first traversal to collect all descendant nodes
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

    // Remove nodes and their expansion state
    nodesToRemove.forEach((removeNodeId) => {
      this.canvas.removeNode(removeNodeId);
      newExpandedNodes.delete(removeNodeId);
    });

    // Remove expansion state of the parent node itself
    newExpandedNodes.delete(nodeId);

    this.expandedNodes.set(newExpandedNodes);

    // Focus back on the collapsed node
    this.canvas.focus([nodeId]);
  }

  /**
   * Destroys all Angular component views
   * Called during graph cleanup to prevent memory leaks
   */
  private reset(): void {
    this.viewRefs.forEach((viewRef) => {
      viewRef.destroy();
    });

    this.viewRefs.clear();
  }
}
