import {
  BufferGeometry,
  CircleGeometry,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from "three";
import { IDag3dEngine } from "./Abstractions";
import { OrbitControls } from "./OrbitControls";

export class ThreeJsDag3dEngine implements IDag3dEngine {
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly perspectiveCamera: PerspectiveCamera;
  private readonly orthographicCamera: OrthographicCamera;

  private controls: OrbitControls | null = null;

  private static readonly NUM_NODES = 5;

  public constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    this.renderer = new WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
    });

    const aspect = this.canvas.width / this.canvas.height;
    this.perspectiveCamera = new PerspectiveCamera(75, aspect, 0.1, 1000);

    const frustumHeight = 10;
    const halfWidth = (frustumHeight * aspect) / 2;
    const halfHeight = frustumHeight / 2;
    this.orthographicCamera = new OrthographicCamera(
      -halfWidth,
      halfWidth,
      halfHeight,
      -halfHeight,
      1,
      1000
    );
  }

  private static readonly USE_PERSPECTIVE = false;

  public InitializeAsync(): Promise<void> {
    // Add circles to scene
    const circleGeo = new CircleGeometry(1, 16);
    const circleMat = new MeshBasicMaterial({ color: 0x00ff00 });
    const circles: Mesh[] = new Array<Mesh>(ThreeJsDag3dEngine.NUM_NODES);
    for (let x = 0; x < ThreeJsDag3dEngine.NUM_NODES; ++x) {
      const circle = new Mesh(circleGeo, circleMat);
      circle.name = `circle-${x}`;
      circle.position.x = 2 * x;
      circle.position.y = Math.random();
      circles[x] = circle;
      this.scene.add(circle);
    }

    // Add connecting line to scene
    const lineMat = new LineBasicMaterial({ color: 0xff0000 });
    const lineGeo = new BufferGeometry().setFromPoints(
      circles.map((x) => x.position)
    );
    const line = new Line(lineGeo, lineMat);
    this.scene.add(line);

    // Position camera
    this.perspectiveCamera.position.z = 5;
    this.orthographicCamera.position.z = 5;

    // Set up controls
    const camera = ThreeJsDag3dEngine.USE_PERSPECTIVE
      ? this.perspectiveCamera
      : this.orthographicCamera;
    this.controls = new OrbitControls(camera, this.canvas);
    this.controls.listenToKeyEvents(window); // optional
    this.controls.enableDamping = true; // an animation loop is required when either damping or auto-rotation are enabled
    this.controls.dampingFactor = 0.05;

    this.controls.screenSpacePanning = false;

    this.controls.minDistance = 1;
    this.controls.maxDistance = 100;

    this.controls.maxPolarAngle = Math.PI / 2;

    return Promise.resolve();
  }

  public Update() {
    this.controls?.update();

    const camera = ThreeJsDag3dEngine.USE_PERSPECTIVE
      ? this.perspectiveCamera
      : this.orthographicCamera;
    this.renderer.render(this.scene, camera);
  }

  public ResizeRenderArea(newWidth: number, newHeight: number) {
    const newAspect = newWidth / newHeight;

    this.perspectiveCamera.aspect = newWidth / newHeight;
    this.perspectiveCamera.updateProjectionMatrix();

    const frustumHeight = 10;
    const halfWidth = (frustumHeight * newAspect) / 2;
    const halfHeight = frustumHeight / 2;
    this.orthographicCamera.left = -halfWidth;
    this.orthographicCamera.right = halfWidth;
    this.orthographicCamera.top = halfHeight;
    this.orthographicCamera.bottom = -halfHeight;
    this.orthographicCamera.updateProjectionMatrix();

    this.renderer.setSize(newWidth, newHeight, false); // Must pass false here or js sadly fights the browser
  }
}
