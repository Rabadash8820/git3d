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


const _changeEvent = { type: "change" };
const _startEvent = { type: "start" };
const _endEvent = { type: "end" };

export interface IInputProvider {}

export class DomInputProvider {}

/**
 * This set of controls performs orbiting, dollying (zooming), and panning.
 * It maintains the "up" direction object.up (+Y by default).
 *
 *      Orbit - left mouse / touch: one-finger move
 *      Zoom - middle mouse, or mousewheel / touch: two-finger spread or squish
 *      Pan - right mouse, or left mouse + ctrl/meta/shiftKey, or arrow keys / touch: two-finger move
 */
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
    this.quat = new Quaternion().setFromUnitVectors(this.camera.up, new Vector3(0, 1, 0));
    this.quatInverse = this.quat.clone().invert();

    this.canvas.addEventListener("contextmenu", this.eventListeners.contextmenu );
    this.canvas.addEventListener("pointerdown", this.eventListeners.pointerdown);
    this.canvas.addEventListener("pointercancel", this.eventListeners.pointercancel);
    this.canvas.addEventListener("wheel", this.eventListeners.wheel, { passive: false });
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

    if (this.autoRotate && this.state === OrbitControls.STATE.NONE)
      this.sphericalDelta.theta -= (OrbitControls.TWO_PI / 3600) * this.autoRotateSpeed;

    const factor: number = this.enableDamping ? this.dampingFactor : 1;
    this.spherical.theta += this.sphericalDelta.theta * factor;
    this.spherical.phi += this.sphericalDelta.phi * factor;

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

    if (this.enableDamping)
      this.target.addScaledVector(this.panOffset, this.dampingFactor);
    else
      this.target.add(this.panOffset);

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
      this.lastPosition.distanceToSquared(this.camera.position) > OrbitControls.EPS ||
      8 * (1 - this.lastQuaternion.dot(this.camera.quaternion)) > OrbitControls.EPS
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
    this.canvas.removeEventListener("contextmenu", this.eventListeners.contextmenu);

    this.canvas.removeEventListener("pointerdown", this.eventListeners.pointerdown);
    this.canvas.removeEventListener("pointercancel", this.eventListeners.pointercancel);
    this.canvas.removeEventListener("wheel", this.eventListeners.wheel);

    this.canvas.removeEventListener("pointermove", this.eventListeners.pointermove);
    this.canvas.removeEventListener("pointerup", this.eventListeners.pointerup);

    if (this._domElementKeyEvents !== null)
      this._domElementKeyEvents.removeEventListener("keydown", this.eventListeners.keydown);

    //this.dispatchEvent( { type: 'dispose' } ); // should this be added here?
  }

  private getZoomScale() {
    return Math.pow(0.95, this.zoomSpeed);
  }

  private readonly vPanLeft = new Vector3();
  private panLeft(distance: number, objectMatrix: Matrix4) {
    this.vPanLeft.setFromMatrixColumn(objectMatrix, 0); // get X column of objectMatrix
    this.vPanLeft.multiplyScalar(-distance);
    this.panOffset.add(this.vPanLeft);
  }

  private readonly vPanUp = new Vector3();
  private panUp(distance: number, objectMatrix: Matrix4) {
    this.vPanUp.setFromMatrixColumn(objectMatrix, this.screenSpacePanning ? 1 : 0);
    if (!this.screenSpacePanning)
      this.vPanUp.crossVectors(this.camera.up, this.vPanUp);

    this.vPanUp.multiplyScalar(distance);

    this.panOffset.add(this.vPanUp);
  }

  // deltaX and deltaY are in pixels; right and down are positive
  private readonly offset = new Vector3();
  private pan(deltaX: number, deltaY: number, width: number, height: number) {
    let leftDist: number;
    let upDist: number;
    if (this.camera instanceof PerspectiveCamera) {
      // perspective
      const position = this.camera.position;
      this.offset.copy(position).sub(this.target);
      const targetDist =
        this.offset.length() *
        Math.tan(((this.camera.fov / 2) * Math.PI) / 180); // half of the fov is center to top of screen

      // we use only clientHeight here so aspect ratio does not distort speed
      const distFactor = (2 * targetDist) / height;
      leftDist = deltaX * distFactor;
      upDist = deltaY * distFactor;
    } else {
      // orthographic
      leftDist = (deltaX * (this.camera.right - this.camera.left)) / this.camera.zoom / width;
      upDist = (deltaY * (this.camera.top - this.camera.bottom)) / this.camera.zoom / height;
    }
    this.panLeft(leftDist, this.camera.matrix);
    this.panUp(upDist, this.camera.matrix);
  }

  private dolly(dollyScale: number, dollyOut: boolean) {
    const dollyFactor = dollyOut ? 1 / dollyScale : dollyScale;
    if (this.camera instanceof PerspectiveCamera) {
      this.scale *= dollyFactor;
    } else {
      this.camera.zoom = Math.max(
        this.minZoom,
        Math.min(this.maxZoom, this.camera.zoom / dollyFactor)
      );
      this.camera.updateProjectionMatrix();
      this.zoomChanged = true;
    }
  }

  //
  // event callbacks - update the object state
  //

  private handleMouseMoveRotate(x: number, y: number) {
    this.rotateEnd.set(x, y);

    this.rotateDelta
      .subVectors(this.rotateEnd, this.rotateStart)
      .multiplyScalar(this.rotateSpeed);

    this.sphericalDelta.theta -= (OrbitControls.TWO_PI * this.rotateDelta.x) / this.canvas.clientHeight;  // yes, height
    this.sphericalDelta.phi -= (OrbitControls.TWO_PI * this.rotateDelta.y) / this.canvas.clientHeight;

    this.rotateStart.copy(this.rotateEnd);
  }

  private handleMouseMoveDolly(x: number, y: number) {
    this.dollyEnd.set(x, y);

    this.dollyDelta.subVectors(this.dollyEnd, this.dollyStart);

    if (this.dollyDelta.y !== 0)
      this.dolly(this.getZoomScale(), this.dollyDelta.y > 0);

    this.dollyStart.copy(this.dollyEnd);
  }

  private handleMouseMovePan(x: number, y: number) {
    this.panEnd.set(x, y);

    this.panDelta
      .subVectors(this.panEnd, this.panStart)
      .multiplyScalar(this.panSpeed);

    this.pan(this.panDelta.x, this.panDelta.y, this.canvas.clientWidth, this.canvas.clientHeight);

    this.panStart.copy(this.panEnd);
  }

  private handleMouseWheel(event: WheelEvent) {
    if (event.deltaY !== 0)
      this.dolly(this.getZoomScale(), event.deltaY > 0);

    this.update();
  }

  private handleKeyDown(event: KeyboardEvent) {
    let needsUpdate = false;

    switch (event.code) {
      case this.keys.UP:
        this.pan(0, this.keyPanSpeed, this.canvas.clientWidth, this.canvas.clientHeight);
        needsUpdate = true;
        break;

      case this.keys.BOTTOM:
        this.pan(0, -this.keyPanSpeed, this.canvas.clientWidth, this.canvas.clientHeight);
        needsUpdate = true;
        break;

      case this.keys.LEFT:
        this.pan(this.keyPanSpeed, 0, this.canvas.clientWidth, this.canvas.clientHeight);
        needsUpdate = true;
        break;

      case this.keys.RIGHT:
        this.pan(-this.keyPanSpeed, 0, this.canvas.clientWidth, this.canvas.clientHeight);
        needsUpdate = true;
        break;
    }

    if (needsUpdate) {
      // prevent the browser from scrolling on cursor keys
      event.preventDefault();
      this.update();
    }
  }

  private handleTouchStartTransform(vector: Vector2) {
    if (this.pointers.length === 1) {
      vector.set(this.pointers[0].pageX, this.pointers[0].pageY);
    } else {
      const x = 0.5 * (this.pointers[0].pageX + this.pointers[1].pageX);
      const y = 0.5 * (this.pointers[0].pageY + this.pointers[1].pageY);
      vector.set(x, y);
    }
  }

  private handleTouchStartDolly() {
    const dx = this.pointers[0].pageX - this.pointers[1].pageX;
    const dy = this.pointers[0].pageY - this.pointers[1].pageY;

    const distance = Math.sqrt(dx * dx + dy * dy);

    this.dollyStart.set(0, distance);
  }

  private handleTouchMoveRotate(pointerId: number, x: number, y: number) {
    if (this.pointers.length === 1) {
      this.rotateEnd.set(x, y);
    } else {
      const position = this.getSecondPointerPosition(pointerId)!;

      const newX = 0.5 * (x + position.x);
      const newY = 0.5 * (y + position.y);

      this.rotateEnd.set(newX, newY);
    }

    this.rotateDelta
      .subVectors(this.rotateEnd, this.rotateStart)
      .multiplyScalar(this.rotateSpeed);

    this.sphericalDelta.theta -= (OrbitControls.TWO_PI * this.rotateDelta.x) / this.canvas.clientHeight;  // yes, height
    this.sphericalDelta.phi -= (OrbitControls.TWO_PI * this.rotateDelta.y) / this.canvas.clientHeight;

    this.rotateStart.copy(this.rotateEnd);
  }

  private handleTouchMovePan(pointerId: number, x: number, y: number) {
    if (this.pointers.length === 1) {
      this.panEnd.set(x, y);
    } else {
      const position = this.getSecondPointerPosition(pointerId)!;

      const newX = 0.5 * (x + position.x);
      const newY = 0.5 * (y + position.y);

      this.panEnd.set(newX, newY);
    }

    this.panDelta
      .subVectors(this.panEnd, this.panStart)
      .multiplyScalar(this.panSpeed);

    this.pan(this.panDelta.x, this.panDelta.y, this.canvas.clientWidth, this.canvas.clientHeight);

    this.panStart.copy(this.panEnd);
  }

  private handleTouchMoveDolly(pointerId: number, x: number, y: number) {
    const position = this.getSecondPointerPosition(pointerId)!;

    const dx = x - position.x;
    const dy = y - position.y;

    const distance = Math.sqrt(dx * dx + dy * dy);

    this.dollyEnd.set(0, distance);
    this.dollyDelta.set(0, Math.pow(this.dollyEnd.y / this.dollyStart.y, this.zoomSpeed));
    this.dolly(this.dollyDelta.y, true);
    this.dollyStart.copy(this.dollyEnd);
  }

  //
  // Event handlers - FSM: listen for events and reset state
  //

  private onPointerDown(event: PointerEvent) {
    if (!this.enabled) return;

    if (this.pointers.length === 0) {
      this.canvas.setPointerCapture(event.pointerId);
      this.canvas.addEventListener("pointermove", this.eventListeners.pointermove);
      this.canvas.addEventListener("pointerup", this.eventListeners.pointerup);
    }

    this.pointers.push(event);

    if (event.pointerType === "touch") this.onTouchStart(event);
    else this.onMouseDown(event);
  }

  private onPointerMove(event: PointerEvent) {
    if (!this.enabled) return;

    if (event.pointerType === "touch")
      this.onTouchMove(event.pointerId, event.pageX, event.pageY);
    else
      this.onMouseMove(event.clientX, event.clientY);
  }

  private onPointerUp(event: PointerEvent) {
    if (!this.enabled) return;

    this.dispatchEvent(_endEvent);
    this.state = OrbitControls.STATE.NONE;

    this.removePointer(event.pointerId);

    if (this.pointers.length > 0) return;

    this.canvas.releasePointerCapture(event.pointerId);
    this.canvas.removeEventListener("pointermove", this.eventListeners.pointermove);
    this.canvas.removeEventListener("pointerup", this.eventListeners.pointerup);
  }

  private onPointerCancel(event: PointerEvent) {
    this.removePointer(event.pointerId);
  }

  private onMouseDown(event: PointerEvent) {
    let mouseAction;
    switch (event.button) {
      case 0: mouseAction = this.mouseButtons.LEFT; break;
      case 1: mouseAction = this.mouseButtons.MIDDLE; break;
      case 2: mouseAction = this.mouseButtons.RIGHT; break;
      default: mouseAction = -1;
    }

    switch (mouseAction) {
      case MOUSE.DOLLY:
        if (!this.enableZoom) return;
        this.dollyStart.set(event.clientX, event.clientY);
        this.state = OrbitControls.STATE.DOLLY;
        break;

      case MOUSE.ROTATE:
        if (event.ctrlKey || event.metaKey || event.shiftKey) {
          if (!this.enablePan) return;
          this.panStart.set(event.clientX, event.clientY);
          this.state = OrbitControls.STATE.PAN;
        } else {
          if (!this.enableRotate) return;
          this.rotateStart.set(event.clientX, event.clientY);
          this.state = OrbitControls.STATE.ROTATE;
        }

        break;

      case MOUSE.PAN:
        if (event.ctrlKey || event.metaKey || event.shiftKey) {
          if (!this.enableRotate) return;
          this.rotateStart.set(event.clientX, event.clientY);
          this.state = OrbitControls.STATE.ROTATE;
        } else {
          if (!this.enablePan) return;
          this.panStart.set(event.clientX, event.clientY);
          this.state = OrbitControls.STATE.PAN;
        }

        break;

      default:
        this.state = OrbitControls.STATE.NONE;
    }

    if (this.state !== OrbitControls.STATE.NONE)
      this.dispatchEvent(_startEvent);
  }

  private onMouseMove(x: number, y: number) {
    switch (this.state) {
      case OrbitControls.STATE.ROTATE:
        if (!this.enableRotate) return;
        this.handleMouseMoveRotate(x, y);
        this.update();
        break;

      case OrbitControls.STATE.DOLLY:
        if (!this.enableZoom) return;
        this.handleMouseMoveDolly(x, y);
        this.update();
        break;

      case OrbitControls.STATE.PAN:
        if (!this.enablePan) return;
        this.handleMouseMovePan(x, y);
        this.update();
        break;
    }
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
    this.trackPointer(event.pointerId, event.pageX, event.pageY);

    if (this.pointers.length === 1 && this.touches.ONE === TOUCH.ROTATE) {
      if (!this.enableRotate) return;
      this.handleTouchStartTransform(this.rotateStart);
      this.state = OrbitControls.STATE.TOUCH_ROTATE;
    }
    else if (this.pointers.length === 1 && this.touches.ONE === TOUCH.PAN) {
      if (!this.enablePan) return;
      this.handleTouchStartTransform(this.panStart);
      this.state = OrbitControls.STATE.TOUCH_PAN;
    }
    else if (this.pointers.length === 2 && this.touches.TWO === TOUCH.DOLLY_PAN) {
      if (!this.enableZoom && !this.enablePan) return;
      if (this.enableZoom) this.handleTouchStartDolly();
      if (this.enablePan) this.handleTouchStartTransform(this.panStart);
      this.state = OrbitControls.STATE.TOUCH_DOLLY_PAN;
    }
    else if (this.pointers.length === 2 && this.touches.TWO === TOUCH.DOLLY_ROTATE) {
      if (!this.enableZoom && !this.enableRotate) return;
      if (this.enableZoom) this.handleTouchStartDolly();
      if (this.enableRotate) this.handleTouchStartTransform(this.rotateStart);
      this.state = OrbitControls.STATE.TOUCH_DOLLY_ROTATE;
    }
    else
      this.state = OrbitControls.STATE.NONE;

    if (this.state !== OrbitControls.STATE.NONE)
      this.dispatchEvent(_startEvent);
  }

  private onTouchMove(pointerId: number, x: number, y: number) {
    this.trackPointer(pointerId, x, y);

    switch (this.state) {
      case OrbitControls.STATE.TOUCH_ROTATE:
        if (!this.enableRotate) return;
        this.handleTouchMoveRotate(pointerId, x, y);
        this.update();
        break;

      case OrbitControls.STATE.TOUCH_PAN:
        if (!this.enablePan) return;
        this.handleTouchMovePan(pointerId, x, y);
        this.update();
        break;

      case OrbitControls.STATE.TOUCH_DOLLY_PAN:
        if (!this.enableZoom && !this.enablePan) return;
        if (this.enableZoom) this.handleTouchMoveDolly(pointerId, x, y);
        if (this.enablePan) this.handleTouchMovePan(pointerId, x, y);
        this.update();
        break;

      case OrbitControls.STATE.TOUCH_DOLLY_ROTATE:
        if (!this.enableZoom && !this.enableRotate) return;
        if (this.enableZoom) this.handleTouchMoveDolly(pointerId, x, y);
        if (this.enableRotate) this.handleTouchMoveRotate(pointerId, x, y);
        this.update();
        break;

      default:
        this.state = OrbitControls.STATE.NONE;
    }
  }

  private onContextMenu(event: MouseEvent) {
    if (!this.enabled) return;
    event.preventDefault();
  }

  private removePointer(pointerId: number) {
    this.pointerPositions.delete(pointerId);

    for (let i = 0; i < this.pointers.length; i++) {
      if (this.pointers[i].pointerId === pointerId) {
        this.pointers.splice(i, 1);
        return;
      }
    }
  }

  private trackPointer(pointerId: number, x: number, y: number) {
    let position = this.pointerPositions.get(pointerId);

    if (position === undefined) {
      position = new Vector2();
      this.pointerPositions.set(pointerId, position);
    }

    position.set(x, y);
  }

  private getSecondPointerPosition(pointerId: number) {
    const pIndex = pointerId === this.pointers[0].pointerId ? 1 : 0;
    return this.pointerPositions.get(this.pointers[pIndex].pointerId);
  }
}
