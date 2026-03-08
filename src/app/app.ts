import { Component, ElementRef, inject, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CanvasAdapter } from './canvas-adapter';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.less',
  providers: [CanvasAdapter],
})
export class App implements OnInit, OnDestroy {
  private readonly store = inject(CanvasAdapter);

  @ViewChild('canvas', { static: true })
  readonly canvas!: ElementRef;

  ngOnInit(): void {
    this.store.init(this.canvas.nativeElement);
  }

  ngOnDestroy(): void {
    this.store.destroy();
  }
}
