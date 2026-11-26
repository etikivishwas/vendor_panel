import { useEffect, useMemo, useState } from "react";
import { LocateFixed, LoaderCircle, MapPin } from "lucide-react";
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import markerIconUrl from "leaflet/dist/images/marker-icon.png";
import markerIconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import markerShadowUrl from "leaflet/dist/images/marker-shadow.png";

import { reverseGeocodeVendorLocation } from "../api/profileApi";

const DEFAULT_POSITION = {
  latitude: 17.4435,
  longitude: 78.3772,
};

const markerIcon = L.icon({
  iconUrl: markerIconUrl,
  iconRetinaUrl: markerIconRetinaUrl,
  shadowUrl: markerShadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
function MapViewController({ position }) {
  const map = useMap();

  useEffect(() => {
    map.setView(
      [position.latitude, position.longitude],
      Math.max(map.getZoom(), 16),
      { animate: true }
    );
  }, [map, position.latitude, position.longitude]);

  return null;
}

function ClickHandler({ disabled, onSelect }) {
  useMapEvents({
    click(event) {
      if (!disabled) {
        onSelect(event.latlng.lat, event.latlng.lng);
      }
    },
  });

  return null;
}

function BusinessLocationMap({
  latitude,
  longitude,
  address,
  city,
  disabled = false,
  onLocationChange,
  onError,
}) {
  const initialPosition = useMemo(() => {
    const hasLatitude =
      latitude !== "" &&
      latitude !== null &&
      latitude !== undefined;

    const hasLongitude =
      longitude !== "" &&
      longitude !== null &&
      longitude !== undefined;

    const parsedLatitude = Number(latitude);
    const parsedLongitude = Number(longitude);

    if (
      hasLatitude &&
      hasLongitude &&
      Number.isFinite(parsedLatitude) &&
      parsedLatitude >= -90 &&
      parsedLatitude <= 90 &&
      Number.isFinite(parsedLongitude) &&
      parsedLongitude >= -180 &&
      parsedLongitude <= 180
    ) {
      return {
        latitude: parsedLatitude,
        longitude: parsedLongitude,
      };
    }

    return DEFAULT_POSITION;
  }, [latitude, longitude]);

  const [position, setPosition] = useState(initialPosition);
  const [resolving, setResolving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    setPosition(initialPosition);
  }, [initialPosition]);

  const selectPosition = async (nextLatitude, nextLongitude) => {
    if (disabled || resolving) {
      return;
    }

    const safeLatitude = Number(nextLatitude);
    const safeLongitude = Number(nextLongitude);

    if (
      !Number.isFinite(safeLatitude) ||
      safeLatitude < -90 ||
      safeLatitude > 90 ||
      !Number.isFinite(safeLongitude) ||
      safeLongitude < -180 ||
      safeLongitude > 180
    ) {
      onError?.("The selected map coordinates are invalid.");
      return;
    }

    const nextPosition = {
      latitude: Number(safeLatitude.toFixed(7)),
      longitude: Number(safeLongitude.toFixed(7)),
    };

    setPosition(nextPosition);
    setResolving(true);
    setStatus("Finding the selected address...");

    try {
      const response = await reverseGeocodeVendorLocation(nextPosition);
      const location = response?.data || {};

      onLocationChange?.({
        ...nextPosition,
        address: location.address || address || "",
        city: location.city || city || "",
      });

      setStatus(
        location.address || location.city
          ? "Location selected. You can edit the address and city below."
          : "Location selected. Enter or edit the address and city below."
      );
    } catch (requestError) {
      onLocationChange?.({
        ...nextPosition,
        address: address || "",
        city: city || "",
      });

      const message =
        requestError.response?.data?.message ||
        "The coordinates were selected, but the address could not be loaded. Enter the address manually.";

      setStatus(message);
    } finally {
      setResolving(false);
    }
  };

  const useCurrentLocation = () => {
    if (
      disabled ||
      locating ||
      resolving
    ) {
      return;
    }

    /*
     * Browser geolocation normally requires:
     * - HTTPS in deployed environments, or
     * - localhost during local development.
     */
    if (!window.isSecureContext) {
      setStatus(
        "Current location requires a secure HTTPS connection. You can still click the map or drag the marker to select the business location."
      );

      /*
       * This is guidance, not a form error.
       * Do not call onError here.
       */
      return;
    }

    if (!navigator.geolocation) {
      setStatus(
        "Current location is not supported by this browser. Click the map or drag the marker to select the business location."
      );

      /*
       * This is also guidance, not a form error.
       */
      return;
    }

    setLocating(true);

    setStatus(
      "Getting the current location..."
    );

    navigator.geolocation.getCurrentPosition(
      async (positionResult) => {
        try {
          const {
            latitude,
            longitude,
          } = positionResult.coords;

          await selectPosition(
            latitude,
            longitude
          );
        } finally {
          setLocating(false);
        }
      },

      (locationError) => {
        setLocating(false);

        let message =
          "Current location could not be detected. Click the map or drag the marker to select the business location.";

        if (
          locationError.code ===
          locationError.PERMISSION_DENIED
        ) {
          message =
            "Location permission is blocked. Allow location access in the browser settings, or click the map to select the business location.";
        } else if (
          locationError.code ===
          locationError.POSITION_UNAVAILABLE
        ) {
          message =
            "The current location is temporarily unavailable. Click the map or drag the marker to select the business location.";
        } else if (
          locationError.code ===
          locationError.TIMEOUT
        ) {
          message =
            "Finding the current location took too long. Try again, or click the map to select the business location.";
        }

        /*
         * Display the message inside the map only.
         * Permission denial is not a profile-validation error.
         */
        setStatus(message);
      },

      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 60000,
      }
    );
  };

  return (
    <div className="business-location-map-shell">
      <div className="business-location-map-heading">
        <div>
          <strong>Select business location</strong>
          <span>
            Click the map or drag the marker. Street address and city will be
            filled automatically and remain editable.
          </span>
        </div>

        <button
          type="button"
          className="use-current-location-button"
          onClick={useCurrentLocation}
          disabled={disabled || locating || resolving}
        >
          {locating ? (
            <LoaderCircle className="profile-spinner" size={16} />
          ) : (
            <LocateFixed size={16} />
          )}
          Use current location
        </button>
      </div>

      <div className="business-location-map">
        <MapContainer
          center={[position.latitude, position.longitude]}
          zoom={16}
          scrollWheelZoom
          className="business-location-leaflet-map"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapViewController position={position} />
          <ClickHandler disabled={disabled} onSelect={selectPosition} />

          <Marker
            position={[position.latitude, position.longitude]}
            icon={markerIcon}
            draggable={!disabled}
            eventHandlers={{
              dragend(event) {
                const markerPosition = event.target.getLatLng();
                selectPosition(markerPosition.lat, markerPosition.lng);
              },
            }}
          />
        </MapContainer>

        {(resolving || locating) && (
          <div className="business-location-map-loading" role="status">
            <LoaderCircle className="profile-spinner" size={22} />
            <span>{locating ? "Locating..." : "Loading address..."}</span>
          </div>
        )}
      </div>

      <div className="selected-coordinate-row">
        <MapPin size={14} />
        <span>
          {position.latitude.toFixed(7)}, {position.longitude.toFixed(7)}
        </span>
      </div>

      {status && (
        <p className="business-location-map-status" aria-live="polite">
          {status}
        </p>
      )}
    </div>
  );
}

export default BusinessLocationMap;
