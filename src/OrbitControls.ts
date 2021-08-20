// Adapted from https://github.com/mrdoob/three.js/blob/master/examples/jsm/controls/OrbitControls.js
// See documentation at https://threejs.org/docs/#examples/en/controls/OrbitControls
// See demo at https://threejs.org/examples/#misc_controls_orbit

import {
  EventDispatcher,
  Matrix4,
  MOUSE,
  OrthographicCamera,
  PerspectiveCamera,
  Quaternion,
  Spherical,
  TOUCH,
  Vector2,
  Vector3,
} from "three";

// This set of controls performs orbiting, dollying (zooming), and panning.
// Unlike TrackballControls, it maintains the "up" direction object.up (+Y by default).
//
//    Orbit - left mouse / touch: one-finger move
//    Zoom - middle mouse, or mousewheel / touch: two-finger spread or squish
//    Pan - right mouse, or left mouse + ctrl/meta/shiftKey, or arrow keys / touch: two-finger move

const _changeEvent = { type: "change" };
const _startEvent = { type: "start" };
const _endEvent = { type: "end" };

export class OrbitControls extends EventDispatcher {
  private static readonly STATE = {
    NONE: -1,
    ROTATE: 0,
    DOLLY: 1,
    PAN: 2,
    TOUCH_ROTATE: 3,
    TOUCH_PAN: 4,
    TOUCH_DOLLY_PAN: 5,
    TOUCH_DOLLY_ROTATE: 6,
  };

  private static readonly TWO_PI = 2 * Math.PI;

  private static readonly EPS = 0.000001;

  private canvas: HTMLCanvasElement;
  private target0: Vector3;
  private position0: Vector3;
  private zoom0;
  private state = OrbitControls.STATE.NONE;

  private _domElementKeyEvents: GlobalEventHandlers | null = null; // the target DOM element for key events

  // The four arrow keys
  public keys = {
    LEFT: "ArrowLeft",
    UP: "ArrowUp",
    RIGHT: "ArrowRight",
    BOTTOM: "ArrowDown",
  };

  // Mouse buttons
  protected readonly mouseButtons = {
    LEFT: MOUSE.ROTATE,
    MIDDLE: MOUSE.DOLLY,
    RIGHT: MOUSE.PAN,
  };

  // Touch fingers
  protected readonly touches = { ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN };

  private readonly eventListeners = {
    contextmenu: this.onContextMenu.bind(this),
    pointerdown: this.onPointerDown.bind(this),
    pointercancel: this.onPointerCancel.bind(this),
    wheel: this.onMouseWheel.bind(this),
    keydown: this.onKeyDown.bind(this),
    pointermove: this.onPointerMove.bind(this),
    pointerup: this.onPointerUp.bind(this),
  };

  // current position in spherical coordinates
  private readonly spherical = new Spherical();
  private readonly sphericalDelta = new Spherical();

  private scale = 1;
  private readonly panOffset = new Vector3();
  private zoomChanged = false;

  private readonly rotateStart = new Vector2();
  private readonly rotateEnd = new Vector2();
  private readonly rotateDelta = new Vector2();

  private readonly panStart = new Vector2();
  private readonly panEnd = new Vector2();
  private readonly panDelta = new Vector2();

  private readonly dollyStart = new Vector2();
  private readonly dollyEnd = new Vector2();
  private readonly dollyDelta = new Vector2();

  private readonly pointers: PointerEvent[] = [];
  private readonly pointerPositions = new Map<number, Vector2>();

  public camera: PerspectiveCamera | OrthographicCamera;
  public enabled: boolean = true;

  /** Sets the location of focus, where the object orbits around */
  public target = new Vector3();

  /** How far you can dolly in ({@link PerspectiveCamera} only) */
  public minDistance = 0;
  /** How far you can dolly out ({@link PerspectiveCamera} only) */
  public maxDistance = Infinity;

  /** How far you can zoom in ({@link OrthographicCamera} only) */
  public minZoom = 0;
  /** How far you can zoom out ({@link OrthographicCamera} only) */
  public maxZoom = Infinity;

  /** Lower limit of vertical orbiting (range 0 to 2π radians) */
  public minPolarAngle = 0;
  /** Upper limit of vertical orbiting (range 0 to 2π radians) */
  public maxPolarAngle = Math.PI;

  /**
   * Lower limit of horizontal orbiting (range -2π to 2π radians)
   * The interval [min, max] must be a sub-interval of [-2π, 2π], with (max - min < 2π)
   */
  public minAzimuthAngle = -Infinity;
  /**
   * Upper limit of horizontal orbiting (range -2π to 2π radians)
   * The interval [min, max] must be a sub-interval of [-2π, 2π], with (max - min < 2π)
   */
  public maxAzimuthAngle = Infinity;

  /** Set to true to enable damping (inertia). If damping is enabled, you must call controls.update() in your animation loop */
  public enableDamping = false;
  public dampingFactor = 0.05;

  /** This option actually enables dollying in and out; left as "zoom" for backwards compatibility. Set to false to disable zooming */
  public enableZoom = true;
  public zoomSpeed = 1.0;

  /** Set to false to disable rotating */
  public enableRotate = true;
  public rotateSpeed = 1.0;

  /** Set to false to disable panning */
  public enablePan = true;
  public panSpeed = 1.0;
  /** If false, pan orthogonal to world-space direction camera.up */
  public screenSpacePanning = true;
  /** Pixels moved per arrow key push */
  public keyPanSpeed = 7.0;

  /** Set to true to automatically rotate around the target. If auto-rotate is enabled, you must call controls.update() in your animation loop */
  public autoRotate = false;
  public autoRotateSpeed = 2.0; // 30 seconds per orbit when fps is 60

  constructor(
    camera: PerspectiveCamera | OrthographicCamera,
    canvas: HTMLCanvasElement
  ) {
    super();

    this.camera = camera;
    this.canvas = canvas;
    this.canvas.style.touchAction = "none"; // disable touch scroll

    // For reset
    this.target0 = this.target.clone();
    this.position0 = this.camera.position.clone();
    this.zoom0 = this.camera.zoom;

    // so camera.up is the orbit axis
    this.quat = new Quaternion().setFromUnitVectors(
      this.camera.up,
      new Vector3(0, 1, 0)
    );
    this.quatInverse = this.quat.clone().invert();

    this.canvas.addEventListener(
      "contextmenu",
      this.eventListeners.contextmenu
    );

    this.canvas.addEventListener(
      "pointerdown",
      this.eventListeners.pointerdown
    );
    this.canvas.addEventListener(
      "pointercancel",
      this.eventListeners.pointercancel
    );
    this.canvas.addEventListener("wheel", this.eventListeners.wheel, {
      passive: false,
    });
  }

  public getPolarAngle() {
    return this.spherical.phi;
  }

  public getAzimuthalAngle() {
    return this.spherical.theta;
  }

  public getDistance() {
    return this.camera.position.distanceTo(this.target);
  }

  public listenToKeyEvents(domElement: GlobalEventHandlers) {
    domElement.addEventListener("keydown", this.eventListeners.keydown);
    this._domElementKeyEvents = domElement;
  }

  public saveState() {
    this.target0.copy(this.target);
    this.position0.copy(this.camera.position);
    this.zoom0 = this.camera.zoom;
  }

  public reset() {
    this.target.copy(this.target0);
    this.camera.position.copy(this.position0);
    this.camera.zoom = this.zoom0;

    this.camera.updateProjectionMatrix();
    this.dispatchEvent(_changeEvent);

    this.update();

    this.state = OrbitControls.STATE.NONE;
  }

  // this method is exposed, but perhaps it would be better if we can make it private...
  private readonly updateOffset = new Vector3();

  // so camera.up is the orbit axis
  private readonly quat: Quaternion;
  private readonly quatInverse: Quaternion;

  private readonly lastPosition = new Vector3();
  private readonly lastQuaternion = new Quaternion();
  public update() {
    const position = this.camera.position;

    this.updateOffset.copy(position).sub(this.target);

    // rotate offset to "y-axis-is-up" space
    this.updateOffset.applyQuaternion(this.quat);

    // angle from z-axis around y-axis
    this.spherical.setFromVector3(this.updateOffset);

    if (this.autoRotate && this.state === OrbitControls.STATE.NONE) {
      this.rotateLeft(this.getAutoRotationAngle());
    }

    if (this.enableDamping) {
      this.spherical.theta += this.sphericalDelta.theta * this.dampingFactor;
      this.spherical.phi += this.sphericalDelta.phi * this.dampingFactor;
    } else {
      this.spherical.theta += this.sphericalDelta.theta;
      this.spherical.phi += this.sphericalDelta.phi;
    }

    // restrict theta to be between desired limits

    let min = this.minAzimuthAngle;
    let max = this.maxAzimuthAngle;

    if (isFinite(min) && isFinite(max)) {
      if (min < -Math.PI) min += OrbitControls.TWO_PI;
      else if (min > Math.PI) min -= OrbitControls.TWO_PI;

      if (max < -Math.PI) max += OrbitControls.TWO_PI;
      else if (max > Math.PI) max -= OrbitControls.TWO_PI;

      if (min <= max) {
        this.spherical.theta = Math.max(
          min,
          Math.min(max, this.spherical.theta)
        );
      } else {
        this.spherical.theta =
          this.spherical.theta > (min + max) / 2
            ? Math.max(min, this.spherical.theta)
            : Math.min(max, this.spherical.theta);
      }
    }

    // restrict phi to be between desired limits
    this.spherical.phi = Math.max(
      this.minPolarAngle,
      Math.min(this.maxPolarAngle, this.spherical.phi)
    );

    this.spherical.makeSafe();

    this.spherical.radius *= this.scale;

    // restrict radius to be between desired limits
    this.spherical.radius = Math.max(
      this.minDistance,
      Math.min(this.maxDistance, this.spherical.radius)
    );

    // move target to panned location

    if (this.enableDamping) {
      this.target.addScaledVector(this.panOffset, this.dampingFactor);
    } else {
      this.target.add(this.panOffset);
    }

    this.updateOffset.setFromSpherical(this.spherical);

    // rotate offset back to "camera-up-vector-is-up" space
    this.updateOffset.applyQuaternion(this.quatInverse);

    position.copy(this.target).add(this.updateOffset);

    this.camera.lookAt(this.target);

    if (this.enableDamping) {
      this.sphericalDelta.theta *= 1 - this.dampingFactor;
      this.sphericalDelta.phi *= 1 - this.dampingFactor;

      this.panOffset.multiplyScalar(1 - this.dampingFactor);
    } else {
      this.sphericalDelta.set(0, 0, 0);

      this.panOffset.set(0, 0, 0);
    }

    this.scale = 1;

    // update condition is:
    // min(camera displacement, camera rotation in radians)^2 > EPS
    // using small-angle approximation cos(x/2) = 1 - x^2 / 8

    if (
      this.zoomChanged ||
      this.lastPosition.distanceToSquared(this.camera.position) >
        OrbitControls.EPS ||
      8 * (1 - this.lastQuaternion.dot(this.camera.quaternion)) >
        OrbitControls.EPS
    ) {
      this.dispatchEvent(_changeEvent);

      this.lastPosition.copy(this.camera.position);
      this.lastQuaternion.copy(this.camera.quaternion);
      this.zoomChanged = false;

      return true;
    }

    return false;
  }

  public dispose() {
    this.canvas.removeEventListener(
      "contextmenu",
      this.eventListeners.contextmenu
    );

    this.canvas.removeEventListener(
      "pointerdown",
      this.eventListeners.pointerdown
    );
    this.canvas.removeEventListener(
      "pointercancel",
      this.eventListeners.pointercancel
    );
    this.canvas.removeEventListener("wheel", this.eventListeners.wheel);

    this.canvas.removeEventListener(
      "pointermove",
      this.eventListeners.pointermove
    );
    this.canvas.removeEventListener("pointerup", this.eventListeners.pointerup);

    if (this._domElementKeyEvents !== null) {
      this._domElementKeyEvents.removeEventListener(
        "keydown",
        this.eventListeners.keydown
      );
    }

    //this.dispatchEvent( { type: 'dispose' } ); // should this be added here?
  }

  private getAutoRotationAngle() {
    return (OrbitControls.TWO_PI / 60 / 60) * this.autoRotateSpeed;
  }

  private getZoomScale() {
    return Math.pow(0.95, this.zoomSpeed);
  }

  private rotateLeft(angle: number) {
    this.sphericalDelta.theta -= angle;
  }

  private rotateUp(angle: number) {
    this.sphericalDelta.phi -= angle;
  }

  private readonly vPanLeft = new Vector3();
  private panLeft(distance: number, objectMatrix: Matrix4) {
    this.vPanLeft.setFromMatrixColumn(objectMatrix, 0); // get X column of objectMatrix
    this.vPanLeft.multiplyScalar(-distance);

    this.panOffset.add(this.vPanLeft);
  }

  private readonly vPanUp = new Vector3();
  private panUp(distance: number, objectMatrix: Matrix4) {
    if (this.screenSpacePanning) {
      this.vPanUp.setFromMatrixColumn(objectMatrix, 1);
    } else {
      this.vPanUp.setFromMatrixColumn(objectMatrix, 0);
      this.vPanUp.crossVectors(this.camera.up, this.vPanUp);
    }

    this.vPanUp.multiplyScalar(distance);

    this.panOffset.add(this.vPanUp);
  }

  // deltaX and deltaY are in pixels; right and down are positive
  private readonly offset = new Vector3();
  private pan(deltaX: number, deltaY: number, width: number, height: number) {
    if (this.camera instanceof PerspectiveCamera) {
      // perspective
      const position = this.camera.position;
      this.offset.copy(position).sub(this.target);
      let targetDistance = this.offset.length();

      // half of the fov is center to top of screen
      targetDistance *= Math.tan(((this.camera.fov / 2) * Math.PI) / 180.0);

      // we use only clientHeight here so aspect ratio does not distort speed
      this.panLeft((2 * deltaX * targetDistance) / height, this.camera.matrix);
      this.panUp((2 * deltaY * targetDistance) / height, this.camera.matrix);
    } else {
      // orthographic
      this.panLeft(
        (deltaX * (this.camera.right - this.camera.left)) /
          this.camera.zoom /
          width,
        this.camera.matrix
      );
      this.panUp(
        (deltaY * (this.camera.top - this.camera.bottom)) /
          this.camera.zoom /
          height,
        this.camera.matrix
      );
    }
  }

  private dollyOut(dollyScale: number) {
    if (this.camera instanceof PerspectiveCamera) {
      this.scale /= dollyScale;
    } else {
      this.camera.zoom = Math.max(
        this.minZoom,
        Math.min(this.maxZoom, this.camera.zoom * dollyScale)
      );
      this.camera.updateProjectionMatrix();
      this.zoomChanged = true;
    }
  }

  private dollyIn(dollyScale: number) {
    if (this.camera instanceof PerspectiveCamera) {
      this.scale *= dollyScale;
    } else {
      this.camera.zoom = Math.max(
        this.minZoom,
        Math.min(this.maxZoom, this.camera.zoom / dollyScale)
      );
      this.camera.updateProjectionMatrix();
      this.zoomChanged = true;
    }
  }

  //
  // event callbacks - update the object state
  //

  private handleMouseDownRotate(event: PointerEvent) {
    this.rotateStart.set(event.clientX, event.clientY);
  }

  private handleMouseDownDolly(event: PointerEvent) {
    this.dollyStart.set(event.clientX, event.clientY);
  }

  private handleMouseDownPan(event: PointerEvent) {
    this.panStart.set(event.clientX, event.clientY);
  }

  private handleMouseMoveRotate(event: PointerEvent) {
    this.rotateEnd.set(event.clientX, event.clientY);

    this.rotateDelta
      .subVectors(this.rotateEnd, this.rotateStart)
      .multiplyScalar(this.rotateSpeed);

    const element = this.canvas;

    this.rotateLeft(
      (OrbitControls.TWO_PI * this.rotateDelta.x) / element.clientHeight
    ); // yes, height

    this.rotateUp(
      (OrbitControls.TWO_PI * this.rotateDelta.y) / element.clientHeight
    );

    this.rotateStart.copy(this.rotateEnd);

    this.update();
  }

  private handleMouseMoveDolly(event: PointerEvent) {
    this.dollyEnd.set(event.clientX, event.clientY);

    this.dollyDelta.subVectors(this.dollyEnd, this.dollyStart);

    if (this.dollyDelta.y > 0) {
      this.dollyOut(this.getZoomScale());
    } else if (this.dollyDelta.y < 0) {
      this.dollyIn(this.getZoomScale());
    }

    this.dollyStart.copy(this.dollyEnd);

    this.update();
  }

  private handleMouseMovePan(event: PointerEvent) {
    this.panEnd.set(event.clientX, event.clientY);

    this.panDelta
      .subVectors(this.panEnd, this.panStart)
      .multiplyScalar(this.panSpeed);

    this.pan(
      this.panDelta.x,
      this.panDelta.y,
      this.canvas.clientWidth,
      this.canvas.clientHeight
    );

    this.panStart.copy(this.panEnd);

    this.update();
  }

  private handleMouseUp(event: PointerEvent) {
    // no-op
  }

  private handleMouseWheel(event: WheelEvent) {
    if (event.deltaY < 0) {
      this.dollyIn(this.getZoomScale());
    } else if (event.deltaY > 0) {
      this.dollyOut(this.getZoomScale());
    }

    this.update();
  }

  private handleKeyDown(event: KeyboardEvent) {
    let needsUpdate = false;

    switch (event.code) {
      case this.keys.UP:
        this.pan(
          0,
          this.keyPanSpeed,
          this.canvas.clientWidth,
          this.canvas.clientHeight
        );
        needsUpdate = true;
        break;

      case this.keys.BOTTOM:
        this.pan(
          0,
          -this.keyPanSpeed,
          this.canvas.clientWidth,
          this.canvas.clientHeight
        );
        needsUpdate = true;
        break;

      case this.keys.LEFT:
        this.pan(
          this.keyPanSpeed,
          0,
          this.canvas.clientWidth,
          this.canvas.clientHeight
        );
        needsUpdate = true;
        break;

      case this.keys.RIGHT:
        this.pan(
          -this.keyPanSpeed,
          0,
          this.canvas.clientWidth,
          this.canvas.clientHeight
        );
        needsUpdate = true;
        break;
    }

    if (needsUpdate) {
      // prevent the browser from scrolling on cursor keys
      event.preventDefault();

      this.update();
    }
  }

  private handleTouchStartRotate() {
    if (this.pointers.length === 1) {
      this.rotateStart.set(this.pointers[0].pageX, this.pointers[0].pageY);
    } else {
      const x = 0.5 * (this.pointers[0].pageX + this.pointers[1].pageX);
      const y = 0.5 * (this.pointers[0].pageY + this.pointers[1].pageY);

      this.rotateStart.set(x, y);
    }
  }

  private handleTouchStartPan() {
    if (this.pointers.length === 1) {
      this.panStart.set(this.pointers[0].pageX, this.pointers[0].pageY);
    } else {
      const x = 0.5 * (this.pointers[0].pageX + this.pointers[1].pageX);
      const y = 0.5 * (this.pointers[0].pageY + this.pointers[1].pageY);

      this.panStart.set(x, y);
    }
  }

  private handleTouchStartDolly() {
    const dx = this.pointers[0].pageX - this.pointers[1].pageX;
    const dy = this.pointers[0].pageY - this.pointers[1].pageY;

    const distance = Math.sqrt(dx * dx + dy * dy);

    this.dollyStart.set(0, distance);
  }

  private handleTouchStartDollyPan() {
    if (this.enableZoom) this.handleTouchStartDolly();
    if (this.enablePan) this.handleTouchStartPan();
  }

  private handleTouchStartDollyRotate() {
    if (this.enableZoom) this.handleTouchStartDolly();
    if (this.enableRotate) this.handleTouchStartRotate();
  }

  private handleTouchMoveRotate(event: PointerEvent) {
    if (this.pointers.length === 1) {
      this.rotateEnd.set(event.pageX, event.pageY);
    } else {
      const position = this.getSecondPointerPosition(event)!;

      const x = 0.5 * (event.pageX + position.x);
      const y = 0.5 * (event.pageY + position.y);

      this.rotateEnd.set(x, y);
    }

    this.rotateDelta
      .subVectors(this.rotateEnd, this.rotateStart)
      .multiplyScalar(this.rotateSpeed);

    this.rotateLeft(
      (OrbitControls.TWO_PI * this.rotateDelta.x) / this.canvas.clientHeight
    ); // yes, height

    this.rotateUp(
      (OrbitControls.TWO_PI * this.rotateDelta.y) / this.canvas.clientHeight
    );

    this.rotateStart.copy(this.rotateEnd);
  }

  private handleTouchMovePan(event: PointerEvent) {
    if (this.pointers.length === 1) {
      this.panEnd.set(event.pageX, event.pageY);
    } else {
      const position = this.getSecondPointerPosition(event)!;

      const x = 0.5 * (event.pageX + position.x);
      const y = 0.5 * (event.pageY + position.y);

      this.panEnd.set(x, y);
    }

    this.panDelta
      .subVectors(this.panEnd, this.panStart)
      .multiplyScalar(this.panSpeed);

    this.pan(
      this.panDelta.x,
      this.panDelta.y,
      this.canvas.clientWidth,
      this.canvas.clientHeight
    );

    this.panStart.copy(this.panEnd);
  }

  private handleTouchMoveDolly(event: PointerEvent) {
    const position = this.getSecondPointerPosition(event)!;

    const dx = event.pageX - position.x;
    const dy = event.pageY - position.y;

    const distance = Math.sqrt(dx * dx + dy * dy);

    this.dollyEnd.set(0, distance);

    this.dollyDelta.set(
      0,
      Math.pow(this.dollyEnd.y / this.dollyStart.y, this.zoomSpeed)
    );

    this.dollyOut(this.dollyDelta.y);

    this.dollyStart.copy(this.dollyEnd);
  }

  private handleTouchMoveDollyPan(event: PointerEvent) {
    if (this.enableZoom) this.handleTouchMoveDolly(event);
    if (this.enablePan) this.handleTouchMovePan(event);
  }

  private handleTouchMoveDollyRotate(event: PointerEvent) {
    if (this.enableZoom) this.handleTouchMoveDolly(event);
    if (this.enableRotate) this.handleTouchMoveRotate(event);
  }

  private handleTouchEnd(event: PointerEvent) {
    // no-op
  }

  //
  // event handlers - FSM: listen for events and reset state
  //

  private onPointerDown(event: PointerEvent) {
    if (!this.enabled) return;

    if (this.pointers.length === 0) {
      this.canvas.setPointerCapture(event.pointerId);

      this.canvas.addEventListener(
        "pointermove",
        this.eventListeners.pointermove
      );
      this.canvas.addEventListener("pointerup", this.eventListeners.pointerup);
    }

    //

    this.addPointer(event);

    if (event.pointerType === "touch") {
      this.onTouchStart(event);
    } else {
      this.onMouseDown(event);
    }
  }

  private onPointerMove(event: PointerEvent) {
    if (!this.enabled) return;

    if (event.pointerType === "touch") {
      this.onTouchMove(event);
    } else {
      this.onMouseMove(event);
    }
  }

  private onPointerUp(event: PointerEvent) {
    if (!this.enabled) return;

    if (event.pointerType === "touch") {
      this.onTouchEnd(event);
    } else {
      this.onMouseUp(event);
    }

    this.removePointer(event);

    //

    if (this.pointers.length === 0) {
      this.canvas.releasePointerCapture(event.pointerId);

      this.canvas.removeEventListener(
        "pointermove",
        this.eventListeners.pointermove
      );
      this.canvas.removeEventListener(
        "pointerup",
        this.eventListeners.pointerup
      );
    }
  }

  private onPointerCancel(event: PointerEvent) {
    this.removePointer(event);
  }

  private onMouseDown(event: PointerEvent) {
    let mouseAction;

    switch (event.button) {
      case 0:
        mouseAction = this.mouseButtons.LEFT;
        break;

      case 1:
        mouseAction = this.mouseButtons.MIDDLE;
        break;

      case 2:
        mouseAction = this.mouseButtons.RIGHT;
        break;

      default:
        mouseAction = -1;
    }

    switch (mouseAction) {
      case MOUSE.DOLLY:
        if (!this.enableZoom) return;

        this.handleMouseDownDolly(event);

        this.state = OrbitControls.STATE.DOLLY;

        break;

      case MOUSE.ROTATE:
        if (event.ctrlKey || event.metaKey || event.shiftKey) {
          if (!this.enablePan) return;

          this.handleMouseDownPan(event);

          this.state = OrbitControls.STATE.PAN;
        } else {
          if (!this.enableRotate) return;

          this.handleMouseDownRotate(event);

          this.state = OrbitControls.STATE.ROTATE;
        }

        break;

      case MOUSE.PAN:
        if (event.ctrlKey || event.metaKey || event.shiftKey) {
          if (!this.enableRotate) return;

          this.handleMouseDownRotate(event);

          this.state = OrbitControls.STATE.ROTATE;
        } else {
          if (!this.enablePan) return;

          this.handleMouseDownPan(event);

          this.state = OrbitControls.STATE.PAN;
        }

        break;

      default:
        this.state = OrbitControls.STATE.NONE;
    }

    if (this.state !== OrbitControls.STATE.NONE) {
      this.dispatchEvent(_startEvent);
    }
  }

  private onMouseMove(event: PointerEvent) {
    if (!this.enabled) return;

    switch (this.state) {
      case OrbitControls.STATE.ROTATE:
        if (!this.enableRotate) return;

        this.handleMouseMoveRotate(event);

        break;

      case OrbitControls.STATE.DOLLY:
        if (!this.enableZoom) return;

        this.handleMouseMoveDolly(event);

        break;

      case OrbitControls.STATE.PAN:
        if (!this.enablePan) return;

        this.handleMouseMovePan(event);

        break;
    }
  }

  private onMouseUp(event: PointerEvent) {
    this.handleMouseUp(event);

    this.dispatchEvent(_endEvent);

    this.state = OrbitControls.STATE.NONE;
  }

  private onMouseWheel(event: WheelEvent) {
    if (
      !this.enabled ||
      !this.enableZoom ||
      (this.state !== OrbitControls.STATE.NONE &&
        this.state !== OrbitControls.STATE.ROTATE)
    )
      return;

    event.preventDefault();

    this.dispatchEvent(_startEvent);

    this.handleMouseWheel(event);

    this.dispatchEvent(_endEvent);
  }

  private onKeyDown(event: KeyboardEvent) {
    if (!this.enabled || !this.enablePan) return;

    this.handleKeyDown(event);
  }

  private onTouchStart(event: PointerEvent) {
    this.trackPointer(event);

    switch (this.pointers.length) {
      case 1:
        switch (this.touches.ONE) {
          case TOUCH.ROTATE:
            if (!this.enableRotate) return;

            this.handleTouchStartRotate();

            this.state = OrbitControls.STATE.TOUCH_ROTATE;

            break;

          case TOUCH.PAN:
            if (!this.enablePan) return;

            this.handleTouchStartPan();

            this.state = OrbitControls.STATE.TOUCH_PAN;

            break;

          default:
            this.state = OrbitControls.STATE.NONE;
        }

        break;

      case 2:
        switch (this.touches.TWO) {
          case TOUCH.DOLLY_PAN:
            if (!this.enableZoom && !this.enablePan) return;

            this.handleTouchStartDollyPan();

            this.state = OrbitControls.STATE.TOUCH_DOLLY_PAN;

            break;

          case TOUCH.DOLLY_ROTATE:
            if (!this.enableZoom && !this.enableRotate) return;

            this.handleTouchStartDollyRotate();

            this.state = OrbitControls.STATE.TOUCH_DOLLY_ROTATE;

            break;

          default:
            this.state = OrbitControls.STATE.NONE;
        }

        break;

      default:
        this.state = OrbitControls.STATE.NONE;
    }

    if (this.state !== OrbitControls.STATE.NONE) {
      this.dispatchEvent(_startEvent);
    }
  }

  private onTouchMove(event: PointerEvent) {
    this.trackPointer(event);

    switch (this.state) {
      case OrbitControls.STATE.TOUCH_ROTATE:
        if (!this.enableRotate) return;

        this.handleTouchMoveRotate(event);

        this.update();

        break;

      case OrbitControls.STATE.TOUCH_PAN:
        if (!this.enablePan) return;

        this.handleTouchMovePan(event);

        this.update();

        break;

      case OrbitControls.STATE.TOUCH_DOLLY_PAN:
        if (!this.enableZoom && !this.enablePan) return;

        this.handleTouchMoveDollyPan(event);

        this.update();

        break;

      case OrbitControls.STATE.TOUCH_DOLLY_ROTATE:
        if (!this.enableZoom && !this.enableRotate) return;

        this.handleTouchMoveDollyRotate(event);

        this.update();

        break;

      default:
        this.state = OrbitControls.STATE.NONE;
    }
  }

  private onTouchEnd(event: PointerEvent) {
    this.handleTouchEnd(event);

    this.dispatchEvent(_endEvent);

    this.state = OrbitControls.STATE.NONE;
  }

  private onContextMenu(event: MouseEvent) {
    if (!this.enabled) return;

    event.preventDefault();
  }

  private addPointer(event: PointerEvent) {
    this.pointers.push(event);
  }

  private removePointer(event: PointerEvent) {
    this.pointerPositions.delete(event.pointerId);

    for (let i = 0; i < this.pointers.length; i++) {
      if (this.pointers[i].pointerId === event.pointerId) {
        this.pointers.splice(i, 1);
        return;
      }
    }
  }

  private trackPointer(event: PointerEvent) {
    let position = this.pointerPositions.get(event.pointerId);

    if (position === undefined) {
      position = new Vector2();
      this.pointerPositions.set(event.pointerId, position);
    }

    position.set(event.pageX, event.pageY);
  }

  private getSecondPointerPosition(event: PointerEvent) {
    const pointer =
      event.pointerId === this.pointers[0].pointerId
        ? this.pointers[1]
        : this.pointers[0];

    return this.pointerPositions.get(pointer.pointerId);
  }
}

// This set of controls performs orbiting, dollying (zooming), and panning.
// Unlike TrackballControls, it maintains the "up" direction object.up (+Y by default).
// This is very similar to OrbitControls, another set of touch behavior
//
//    Orbit - right mouse, or left mouse + ctrl/meta/shiftKey / touch: two-finger rotate
//    Zoom - middle mouse, or mousewheel / touch: two-finger spread or squish
//    Pan - left mouse, or arrow keys / touch: one-finger move

export class MapControls extends OrbitControls {
  public constructor(
    camera: PerspectiveCamera | OrthographicCamera,
    canvas: HTMLCanvasElement
  ) {
    super(camera, canvas);

    super.mouseButtons.LEFT = MOUSE.PAN;
    super.mouseButtons.RIGHT = MOUSE.ROTATE;

    this.touches.ONE = TOUCH.PAN;
    this.touches.TWO = TOUCH.DOLLY_ROTATE;

    this.screenSpacePanning = false; // pan orthogonal to world-space direction camera.up
  }
}
