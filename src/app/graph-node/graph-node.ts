import { AfterViewInit, Component, ElementRef, inject, Input, ViewChild } from '@angular/core';
import { AppStore } from '../app-store';
import { BehaviorSubject, combineLatest, map, Observable } from 'rxjs';
import { AsyncPipe } from '@angular/common';

@Component({
  selector: 'app-graph-node',
  imports: [AsyncPipe],
  templateUrl: './graph-node.html',
  styleUrl: './graph-node.less',
})
export class GraphNode implements AfterViewInit {
  @ViewChild('portIn', { static: true })
  portIn!: ElementRef;

  @ViewChild('portOut', { static: true })
  portOut!: ElementRef;

  private readonly store = inject(AppStore);

  protected readonly nodeId$ = new BehaviorSubject<number | null>(null);

  protected hasChildren = false;

  protected readonly expanded$: Observable<boolean> = combineLatest([
    this.nodeId$,
    this.store.expandedNodes$,
  ]).pipe(
    map(([nodeId, expandedNodes]) => {
      return nodeId !== null && expandedNodes.has(nodeId);
    }),
  );

  @Input({ required: true })
  set id(value: number) {
    this.nodeId$.next(value);
    this.hasChildren = this.store.hasChildren(value);
  }

  @Input({ required: true })
  name!: string;

  ngAfterViewInit(): void {
    this.store.renderNode(this.nodeId$.getValue()!);
  }

  protected expand(): void {
    this.store.expandNode(this.nodeId$.getValue()!);
  }

  protected collapse(): void {
    this.store.collapseNode(this.nodeId$.getValue()!);
  }
}
