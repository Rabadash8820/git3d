import * as Three from "three";
import { IDag3dEngine } from "./Abstractions";

export class ThreeJsDag3dEngine implements IDag3dEngine {
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: Three.WebGLRenderer;
  private readonly scene: Three.Scene = new Three.Scene();
  private readonly camera: Three.PerspectiveCamera;

  private static readonly NUM_NODES = 5;

  public constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    this.renderer = new Three.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
    });

    this.camera = new Three.PerspectiveCamera(
      75,
      this.canvas.width / this.canvas.height,
      0.1,
      1000
    );
  }

  public InitializeAsync(): Promise<void> {
    // Add circles to scene
    const circleGeo = new Three.CircleGeometry(1, 16);
    const circleMat = new Three.MeshBasicMaterial({ color: 0x00ff00 });
    const circles: Three.Mesh[] = new Array<Three.Mesh>(
      ThreeJsDag3dEngine.NUM_NODES
    );
    for (let x = 0; x < ThreeJsDag3dEngine.NUM_NODES; ++x) {
      const circle = new Three.Mesh(circleGeo, circleMat);
      circle.name = `circle-${x}`;
      circle.position.x = 2 * x;
      circle.position.y = Math.random();
      circles[x] = circle;
      this.scene.add(circle);
    }

    // Add connecting line to scene
    const lineMat = new Three.LineBasicMaterial({ color: 0xff0000 });
    const lineGeo = new Three.BufferGeometry().setFromPoints(
      circles.map((x) => x.position)
    );
    const line = new Three.Line(lineGeo, lineMat);
    this.scene.add(line);

    this.camera.position.z = 5;

    return Promise.resolve();
  }

  public Update() {
    // Fit canvas to display
    const newWidth = this.canvas.offsetWidth;
    const newHeight = this.canvas.offsetHeight;
    if (this.canvas.width !== newWidth || this.canvas.height !== newHeight) {
      this.renderer.setSize(newWidth, newHeight, false); // Must pass false here or three.js sadly fights the browser
      this.camera.aspect = newWidth / newHeight;
      this.camera.updateProjectionMatrix();
    }

    this.renderer.render(this.scene, this.camera);
  }
}
