import {
  Children,
  createContext,
  forwardRef,
  isValidElement,
  useContext,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import MapView, {
  Marker as RNMarker,
  Polyline as RNPolyline,
} from "react-native-maps";
import * as ExpoLocation from "expo-location";
import type {
  CameraRef,
  MapRef,
  StyleSpecification,
} from "@maplibre/maplibre-react-native";

type MapLibreRuntime = {
  Callout: React.ComponentType<any>;
  Camera: React.ComponentType<any>;
  GeoJSONSource: React.ComponentType<any>;
  Layer: React.ComponentType<any>;
  LocationManager: {
    requestPermissions: () => Promise<boolean>;
  };
  Map: React.ComponentType<any>;
  Marker: React.ComponentType<any>;
  UserLocation: React.ComponentType<any>;
  useCurrentPosition: () => any;
};

let mapLibreRuntime: MapLibreRuntime | null = null;
let mapLibreLoadError: unknown = null;

try {
  mapLibreRuntime = require("@maplibre/maplibre-react-native") as MapLibreRuntime;
} catch (error) {
  mapLibreLoadError = error;
}

const HAS_MAPLIBRE = Boolean(
  mapLibreRuntime?.Map && mapLibreRuntime?.Camera && mapLibreRuntime?.Marker,
);

if (!HAS_MAPLIBRE && mapLibreLoadError) {
  console.warn(
    "MapLibre native module is unavailable. Falling back to react-native-maps.",
  );
}

function cx(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(" ");
}

function deltaToZoom(longitudeDelta: number) {
  const safeDelta = Math.max(longitudeDelta, 0.0001);
  return Math.max(0, Math.min(20, Math.log2(360 / safeDelta)));
}

function zoomToDelta(zoom: number) {
  const safeZoom = Math.max(0, Math.min(20, zoom));
  return Math.max(0.0001, 360 / Math.pow(2, safeZoom));
}

type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

export type MapRefHandle = {
  animateToRegion: (region: Region, duration?: number) => void;
};

type MapRuntime = "maplibre" | "react-native-maps";

type MapContextValue = {
  mapRef: RefObject<any>;
  cameraRef: RefObject<any>;
  isLoaded: boolean;
  theme: "light" | "dark";
  runtime: MapRuntime;
  setFallbackUserLocationVisible?: (visible: boolean) => void;
};

const MapContext = createContext<MapContextValue | null>(null);

function useMap() {
  const context = useContext(MapContext);
  if (!context) {
    throw new Error("useMap must be used within a Map component");
  }
  return context;
}

const fallbackLocationManager = {
  requestPermissions: async () => {
    const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
    return status === "granted";
  },
};

const LocationManager =
  HAS_MAPLIBRE && mapLibreRuntime?.LocationManager
    ? mapLibreRuntime.LocationManager
    : fallbackLocationManager;

const useCurrentPosition =
  HAS_MAPLIBRE && mapLibreRuntime?.useCurrentPosition
    ? mapLibreRuntime.useCurrentPosition
    : () => null;

const defaultStyles: {
  dark: string | StyleSpecification;
  light: string | StyleSpecification;
} = {
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  light: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
};

type MapStyleOption = string | StyleSpecification;

type MapProps = {
  children?: ReactNode;
  styles?: {
    light?: MapStyleOption;
    dark?: MapStyleOption;
  };
  center?: [number, number];
  zoom?: number;
  className?: string;
  showLoader?: boolean;
};

const DefaultLoader = () => (
  <View className="absolute inset-0 justify-center items-center bg-white/80">
    <ActivityIndicator size="small" color="#999" />
  </View>
);

const Map = forwardRef<MapRefHandle, MapProps>(function Map(
  {
    children,
    styles,
    center = [0, 0],
    zoom = 10,
    className,
    showLoader = true,
  },
  ref,
) {
  const runtime: MapRuntime = HAS_MAPLIBRE ? "maplibre" : "react-native-maps";
  const mapRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [fallbackShowUserLocation, setFallbackShowUserLocation] =
    useState(false);
  const colorScheme = useColorScheme();
  const theme = colorScheme === "dark" ? "dark" : "light";

  const mapStyle =
    theme === "dark"
      ? styles?.dark ?? defaultStyles.dark
      : styles?.light ?? defaultStyles.light;

  useImperativeHandle(ref, () => ({
    animateToRegion: (region, duration = 1000) => {
      if (runtime === "maplibre" && cameraRef.current?.easeTo) {
        cameraRef.current.easeTo({
          center: [region.longitude, region.latitude],
          zoom: deltaToZoom(region.longitudeDelta),
          duration,
        });
        return;
      }

      if (mapRef.current?.animateToRegion) {
        mapRef.current.animateToRegion(
          {
            latitude: region.latitude,
            longitude: region.longitude,
            latitudeDelta: region.latitudeDelta,
            longitudeDelta: region.longitudeDelta,
          },
          duration,
        );
      }
    },
  }));

  const handleMapReady = () => {
    if (!isLoaded) {
      setIsLoaded(true);
    }
  };

  const initialDelta = zoomToDelta(zoom);

  return (
    <MapContext.Provider
      value={{
        mapRef,
        cameraRef,
        isLoaded,
        theme,
        runtime,
        setFallbackUserLocationVisible: setFallbackShowUserLocation,
      }}
    >
      <View className={cx("flex-1 relative", className)}>
        {runtime === "maplibre" ? (
          <>
            {(() => {
              const MapLibreMap = mapLibreRuntime!.Map;
              const Camera = mapLibreRuntime!.Camera;

              return (
                <MapLibreMap
                  ref={mapRef}
                  style={{ flex: 1 }}
                  mapStyle={mapStyle}
                  onDidFinishLoadingMap={handleMapReady}
                  compass={false}
                  logo={false}
                  attribution={false}
                >
                  <Camera
                    ref={cameraRef}
                    zoom={zoom}
                    center={center}
                    easing="fly"
                    duration={1000}
                  />
                  {children}
                </MapLibreMap>
              );
            })()}
          </>
        ) : (
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFillObject}
            initialRegion={{
              latitude: center[1],
              longitude: center[0],
              latitudeDelta: initialDelta,
              longitudeDelta: initialDelta,
            }}
            onMapReady={handleMapReady}
            showsCompass={false}
            toolbarEnabled={false}
            showsUserLocation={fallbackShowUserLocation}
            showsMyLocationButton={
              Platform.OS === "android" && fallbackShowUserLocation
            }
          >
            {children}
          </MapView>
        )}

        {showLoader && !isLoaded && <DefaultLoader />}
      </View>
    </MapContext.Provider>
  );
});

function anchorObjectToAnchorString(anchor: { x: number; y: number }) {
  const horizontal =
    anchor.x <= 0.25 ? "left" : anchor.x >= 0.75 ? "right" : "center";
  const vertical =
    anchor.y <= 0.25 ? "top" : anchor.y >= 0.75 ? "bottom" : "center";

  if (horizontal === "center" && vertical === "center") return "center";
  if (horizontal === "center") return vertical;
  if (vertical === "center") return horizontal;

  return `${vertical}-${horizontal}` as
    | "top-left"
    | "top-right"
    | "bottom-left"
    | "bottom-right";
}

function extractText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map((part) => extractText(part)).join(" ").trim();
  }

  if (isValidElement<{ children?: ReactNode }>(node)) {
    return extractText(node.props.children);
  }

  return "";
}

type MarkerContextValue = {
  coordinate: [number, number];
};

const MarkerContext = createContext<MarkerContextValue | null>(null);

type MapMarkerProps = {
  children?: ReactNode;
  label?: string;
  anchor?: { x: number; y: number };
  allowOverlap?: boolean;
  onPress?: () => void;
} &
  (
    | { coordinate: [number, number]; longitude?: never; latitude?: never }
    | { longitude: number; latitude: number; coordinate?: never }
  );

function MapMarker({
  children,
  label,
  anchor = { x: 0.5, y: 0.5 },
  allowOverlap: _allowOverlap = false,
  onPress,
  ...positionProps
}: MapMarkerProps) {
  const id = useId();
  const { runtime } = useMap();

  const coordinate: [number, number] =
    "coordinate" in positionProps && positionProps.coordinate
      ? positionProps.coordinate
      : [positionProps.longitude, positionProps.latitude];

  if (runtime === "maplibre") {
    const MapLibreMarker = mapLibreRuntime!.Marker;

    return (
      <MarkerContext.Provider value={{ coordinate }}>
        <MapLibreMarker
          id={id}
          lngLat={coordinate}
          anchor={anchorObjectToAnchorString(anchor)}
        >
          <Pressable onPress={onPress}>
            <View className="flex flex-row items-center justify-center">
              {children || <DefaultMarkerIcon />}
              {label && <MarkerLabel>{label}</MarkerLabel>}
            </View>
          </Pressable>
        </MapLibreMarker>
      </MarkerContext.Provider>
    );
  }

  const markerChildren: ReactNode[] = [];
  let popupTitle: string | undefined;
  let popupDescription: string | undefined;

  Children.forEach(children, (child) => {
    if (isValidElement(child) && child.type === MarkerPopup) {
      const childProps = child.props as MarkerPopupProps;
      popupTitle = childProps.title;
      popupDescription = extractText(childProps.children);
      return;
    }

    markerChildren.push(child);
  });

  return (
    <RNMarker
      coordinate={{ latitude: coordinate[1], longitude: coordinate[0] }}
      anchor={anchor}
      title={popupTitle}
      description={popupDescription || undefined}
      onPress={onPress ? () => onPress() : undefined}
      tracksViewChanges
    >
      <View style={styles.centered}>
        {markerChildren.length > 0 ? markerChildren : <DefaultMarkerIcon />}
        {label && <MarkerLabel>{label}</MarkerLabel>}
      </View>
    </RNMarker>
  );
}

type MarkerContentProps = {
  children?: ReactNode;
  className?: string;
};

function MarkerContent({ children, className }: MarkerContentProps) {
  return (
    <View className={cx("items-center justify-center", className)}>
      {children || <DefaultMarkerIcon />}
    </View>
  );
}

function DefaultMarkerIcon() {
  return (
    <View
      className="w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow-md"
      style={{ elevation: 5 }}
    />
  );
}

type MarkerPopupProps = {
  children: ReactNode;
  className?: string;
  title?: string;
};

function MarkerPopup({ children, className, title }: MarkerPopupProps) {
  if (!HAS_MAPLIBRE) {
    return null;
  }

  const Callout = mapLibreRuntime!.Callout;

  return (
    <Callout title={title} className={className}>
      <View className="p-3 min-w-[100px] max-w-[300px]">{children}</View>
    </Callout>
  );
}

type MarkerLabelProps = {
  children: ReactNode;
  className?: string;
  classNameText?: string;
  position?: "top" | "bottom";
};

function MarkerLabel({
  children,
  className,
  classNameText,
  position = "top",
}: MarkerLabelProps) {
  return (
    <View
      className={cx(
        "absolute left-1/2 translate-x-[-50%]",
        position === "top" ? "mb-1 bottom-full" : "mt-1 top-full",
        className,
      )}
    >
      <Text className={cx("text-[10px] font-semibold text-foreground", classNameText)}>
        {children}
      </Text>
    </View>
  );
}

type MapControlsProps = {
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  showZoom?: boolean;
  showLocate?: boolean;
  className?: string;
  onLocate?: (coords: { longitude: number; latitude: number }) => void;
};

function MapControls({
  position = "bottom-right",
  showZoom = true,
  showLocate = false,
  className,
  onLocate,
}: MapControlsProps) {
  const { cameraRef, mapRef, isLoaded, runtime } = useMap();
  const [waitingForLocation, setWaitingForLocation] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(10);

  if (runtime !== "maplibre") {
    return null;
  }

  const handleZoomIn = async () => {
    if (cameraRef.current && mapRef.current) {
      const center = await mapRef.current.getCenter();
      const newZoom = Math.min(currentZoom + 1, 20);
      setCurrentZoom(newZoom);
      cameraRef.current.easeTo({
        center,
        zoom: newZoom,
        duration: 300,
      });
    }
  };

  const handleZoomOut = async () => {
    if (cameraRef.current && mapRef.current) {
      const center = await mapRef.current.getCenter();
      const newZoom = Math.max(currentZoom - 1, 0);
      setCurrentZoom(newZoom);
      cameraRef.current.easeTo({
        center,
        zoom: newZoom,
        duration: 300,
      });
    }
  };

  const handleLocate = async () => {
    setWaitingForLocation(true);
    try {
      if (cameraRef.current && onLocate) {
        const coords = { longitude: 0, latitude: 0 };
        cameraRef.current.flyTo({
          center: [coords.longitude, coords.latitude],
          zoom: 14,
          duration: 1500,
        });
        onLocate(coords);
      }
    } catch (error) {
      console.error("Error getting location:", error);
    } finally {
      setWaitingForLocation(false);
    }
  };

  if (!isLoaded) return null;

  const positionStyle = {
    "top-left": { top: 8, left: 8 },
    "top-right": { top: 8, right: 8 },
    "bottom-left": { bottom: 8, left: 8 },
    "bottom-right": { bottom: 8, right: 8 },
  }[position];

  return (
    <View className={cx("absolute gap-1.5", className)} style={positionStyle}>
      {showZoom && (
        <View
          className="rounded border border-gray-200 bg-white shadow-sm overflow-hidden"
          style={{ elevation: 2 }}
        >
          <ControlButton onPress={handleZoomIn} label="+">
            <Text className="text-lg font-semibold text-gray-700">+</Text>
          </ControlButton>
          <View className="h-[1px] bg-gray-200" />
          <ControlButton onPress={handleZoomOut} label="-">
            <Text className="text-lg font-semibold text-gray-700">-</Text>
          </ControlButton>
        </View>
      )}

      {showLocate && (
        <View
          className="rounded border border-gray-200 bg-white shadow-sm overflow-hidden"
          style={{ elevation: 2 }}
        >
          <ControlButton
            onPress={handleLocate}
            label="locate"
            disabled={waitingForLocation}
          >
            {waitingForLocation ? (
              <ActivityIndicator size="small" color="#666" />
            ) : (
              <Text className="text-lg font-semibold text-gray-700">L</Text>
            )}
          </ControlButton>
        </View>
      )}
    </View>
  );
}

function ControlButton({
  onPress,
  label,
  children,
  disabled = false,
}: {
  onPress: () => void;
  label: string;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className="w-8 h-8 justify-center items-center active:bg-gray-100"
      style={disabled ? { opacity: 0.5 } : undefined}
      accessibilityLabel={label}
      accessibilityRole="button"
    >
      {children}
    </Pressable>
  );
}

type MapRouteProps = {
  coordinates: Array<[number, number]>;
  color?: string;
  width?: number;
  opacity?: number;
  dashArray?: [number, number];
};

function MapRoute({
  coordinates,
  color = "#4285F4",
  width = 3,
  opacity = 0.8,
  dashArray,
}: MapRouteProps) {
  const id = useId();
  const { runtime } = useMap();

  if (coordinates.length < 2) {
    return null;
  }

  if (runtime === "maplibre") {
    const GeoJSONSource = mapLibreRuntime!.GeoJSONSource;
    const Layer = mapLibreRuntime!.Layer;
    const sourceId = `route-source-${id}`;
    const layerId = `route-layer-${id}`;

    const shape = {
      type: "Feature" as const,
      properties: {},
      geometry: {
        type: "LineString" as const,
        coordinates,
      },
    };

    return (
      <GeoJSONSource id={sourceId} data={shape}>
        <Layer
          id={layerId}
          type="line"
          style={{
            lineColor: color,
            lineWidth: width,
            lineOpacity: opacity,
            ...(dashArray && { lineDasharray: dashArray }),
            lineJoin: "round",
            lineCap: "round",
          }}
        />
      </GeoJSONSource>
    );
  }

  return (
    <RNPolyline
      coordinates={coordinates.map(([lng, lat]) => ({
        latitude: lat,
        longitude: lng,
      }))}
      strokeColor={color}
      strokeWidth={width}
      lineDashPattern={dashArray ? [...dashArray] : undefined}
    />
  );
}

type MapUserLocationProps = {
  visible?: boolean;
  showAccuracy?: boolean;
  showHeading?: boolean;
  animated?: boolean;
  minDisplacement?: number;
  onPress?: () => void;
  autoRequestPermission?: boolean;
};

function MapUserLocation({
  visible = true,
  showAccuracy = true,
  showHeading = false,
  animated = true,
  minDisplacement,
  onPress,
  autoRequestPermission = true,
}: MapUserLocationProps) {
  const { runtime, setFallbackUserLocationVisible } = useMap();
  const [hasPermission, setHasPermission] = useState(false);
  const [permissionChecked, setPermissionChecked] = useState(false);

  useEffect(() => {
    let mounted = true;

    const checkAndRequestPermissions = async () => {
      try {
        if (autoRequestPermission) {
          const granted = await LocationManager.requestPermissions();
          if (mounted) {
            setHasPermission(granted);
            setPermissionChecked(true);
            if (runtime === "react-native-maps") {
              setFallbackUserLocationVisible?.(granted && visible);
            }
          }
        } else {
          if (mounted) {
            setHasPermission(true);
            setPermissionChecked(true);
            if (runtime === "react-native-maps") {
              setFallbackUserLocationVisible?.(visible);
            }
          }
        }
      } catch (error) {
        console.error("Error requesting location permissions:", error);
        if (mounted) {
          setHasPermission(false);
          setPermissionChecked(true);
          if (runtime === "react-native-maps") {
            setFallbackUserLocationVisible?.(false);
          }
        }
      }
    };

    if (visible) {
      checkAndRequestPermissions();
    } else if (runtime === "react-native-maps") {
      setFallbackUserLocationVisible?.(false);
    }

    return () => {
      mounted = false;
      if (runtime === "react-native-maps") {
        setFallbackUserLocationVisible?.(false);
      }
    };
  }, [
    autoRequestPermission,
    runtime,
    setFallbackUserLocationVisible,
    visible,
  ]);

  if (runtime !== "maplibre") {
    return null;
  }

  if (!visible || !permissionChecked || !hasPermission) {
    return null;
  }

  const UserLocation = mapLibreRuntime!.UserLocation;

  return (
    <UserLocation
      accuracy={showAccuracy}
      heading={showHeading}
      animated={animated}
      minDisplacement={minDisplacement}
      onPress={onPress}
    />
  );
}

const styles = StyleSheet.create({
  centered: {
    alignItems: "center",
    justifyContent: "center",
  },
});

export { LocationManager };

export {
  Map,
  MapControls,
  MapMarker,
  MapRoute,
  MapUserLocation,
  MarkerContent,
  MarkerLabel,
  MarkerPopup,
  useCurrentPosition,
  useMap,
};
