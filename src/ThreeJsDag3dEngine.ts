import * as Three from "three";
import { IDag3dEngine } from "./Abstractions";

export class ThreeJsDag3dEngine implements IDag3dEngine {
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: Three.WebGLRenderer;
  private readonly scene: Three.Scene = new Three.Scene();
  private readonly camera: Three.PerspectiveCamera;

  private cube: Three.Mesh | null = null;

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
    this.cube = new Three.Mesh(
      new Three.BoxGeometry(),
      new Three.MeshBasicMaterial({ color: 0x00ff00 })
    );
    this.scene.add(this.cube);

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

    if (this.cube) {
      this.cube.rotation.x += 0.01;
      this.cube.rotation.y += 0.01;
    }
    this.renderer.render(this.scene, this.camera);
  }
}
