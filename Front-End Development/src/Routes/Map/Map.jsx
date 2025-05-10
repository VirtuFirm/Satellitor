import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Map.css";
import L from "leaflet";
import leafletImage from "leaflet-image";
import "leaflet/dist/leaflet.css";
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const Map = () => {
    const mapRef = useRef(null);
    const hiddenMapRef = useRef(null);
    const navigate = useNavigate();
    const [captureDisabled, setCaptureDisabled] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [isGoToLoading, setIsGoToLoading] = useState(false);
    const [showInstructions, setShowInstructions] = useState(true);
    const [showBetaBanner, setShowBetaBanner] = useState(true);
    const [coordinates, setCoordinates] = useState({
        latitude: "",
        longitude: ""
    });
    const [error, setError] = useState("");
    const [isSmallScreen, setIsSmallScreen] = useState(window.innerWidth <= 560);

    // Egypt's boundaries
    const EGYPT_BOUNDS = {
        minLat: 22.0,
        maxLat: 31.6,
        minLng: 25.0,
        maxLng: 36.9
    };

    const handleCoordinateChange = (e) => {
        const { name, value } = e.target;
        setCoordinates(prev => ({
            ...prev,
            [name]: value
        }));
        setError("");
    };

    const validateCoordinates = () => {
        const lat = parseFloat(coordinates.latitude);
        const lng = parseFloat(coordinates.longitude);

        if (isNaN(lat) || isNaN(lng)) {
            setError("Please enter valid numbers for both coordinates");
            return false;
        }

        if (lat < EGYPT_BOUNDS.minLat || lat > EGYPT_BOUNDS.maxLat) {
            setError(`Latitude must be between ${EGYPT_BOUNDS.minLat} and ${EGYPT_BOUNDS.maxLat}`);
            return false;
        }

        if (lng < EGYPT_BOUNDS.minLng || lng > EGYPT_BOUNDS.maxLng) {
            setError(`Longitude must be between ${EGYPT_BOUNDS.minLng} and ${EGYPT_BOUNDS.maxLng}`);
            return false;
        }

        return true;
    };

    const handleGoToCoordinates = () => {
        if (!validateCoordinates()) return;

        const lat = parseFloat(coordinates.latitude);
        const lng = parseFloat(coordinates.longitude);

        if (mapRef.current) {
            setIsGoToLoading(true);
            mapRef.current.setView([lat, lng], 15);
            // Simulate a small delay for the loading effect
            setTimeout(() => {
                setCaptureDisabled(false);
                setIsGoToLoading(false);
            }, 500);
        }
    };

    useEffect(() => {
        const handleResize = () => {
            setIsSmallScreen(window.innerWidth <= 550);
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const initMap = () => {
            if (mapRef.current) return;

            // Fix Leaflet's default icon path issues
            delete L.Icon.Default.prototype._getIconUrl;
            L.Icon.Default.mergeOptions({
                iconUrl: icon,
                shadowUrl: iconShadow
            });
            
            const egyptBounds = [
                [22.0, 25.0],
                [31.6, 36.9]
            ];

            const map = L.map("map", {
                center: [26.8206, 30.8025],
                zoom: 5,
                maxBounds: egyptBounds,
                maxBoundsViscosity: 1.0,
                zoomControl: true
            });

            L.tileLayer("https://api.maptiler.com/maps/satellite/{z}/{x}/{y}.jpg?key=XANnwLyOkpjBovOqPgZk", {
                attribution: '&copy; MapTiler',
                minZoom: 5,
                maxZoom: 15,
                tileSize: 512,
                zoomOffset: -1
            }).addTo(map);

            map.on("zoomend", () => {
                setCaptureDisabled(map.getZoom() !== 15);
            });

            mapRef.current = map;

            // Initialize hidden map for small screens
            if (isSmallScreen) {
                const hiddenMap = L.map("hidden-map", {
                    center: [26.8206, 30.8025],
                    zoom: 15,
                    maxBounds: egyptBounds,
                    maxBoundsViscosity: 1.0,
                    zoomControl: false,
                    attributionControl: false
                });

                L.tileLayer("https://api.maptiler.com/maps/satellite/{z}/{x}/{y}.jpg?key=XANnwLyOkpjBovOqPgZk", {
                    attribution: '&copy; MapTiler',
                    minZoom: 5,
                    maxZoom: 15,
                    tileSize: 512,
                    zoomOffset: -1
                }).addTo(hiddenMap);

                hiddenMapRef.current = hiddenMap;
            }
        };

        const timer = setTimeout(initMap, 100);

        return () => {
            clearTimeout(timer);
            if (mapRef.current) {
                mapRef.current.remove();
            }
            if (hiddenMapRef.current) {
                hiddenMapRef.current.remove();
            }
        };
    }, [isSmallScreen]);

    const handleCapture = async () => {
        if (isLoading) return;

        setIsLoading(true);
        const center = mapRef.current.getCenter();

        try {
            const mapToCapture = isSmallScreen ? hiddenMapRef.current : mapRef.current;
            
            if (isSmallScreen) {
                // Set the hidden map to the same center as the main map
                mapToCapture.setView([center.lat, center.lng], 15);
                // Wait for map to load and tiles to render
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            leafletImage(mapToCapture, (err, canvas) => {
                if (err) {
                    console.error("Error capturing map:", err);
                    setIsLoading(false);
                    return;
                }

                canvas.toBlob((blob) => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        localStorage.setItem('capturedMapImage', reader.result);
                    };
                    reader.readAsDataURL(blob);

                    const formData = new FormData();
                    formData.append("latitude", center.lat);
                    formData.append("longitude", center.lng);
                    formData.append("image", blob, "image.png");

                    fetch("https://satellitor.duckdns.org/process", {
                        method: "POST",
                        body: formData
                    })
                    .then(response => {
                        if (!response.ok) {
                            throw new Error('Network response was not ok');
                        }
                        return response.json();
                    })
                    .then(data => {
                        localStorage.setItem('mapAnalysisData', JSON.stringify({
                            coordinates: {  
                                latitude: center.lat,
                                longitude: center.lng
                            },
                            analysis: data
                        }));
                        navigate("/results");
                    })
                    .catch(error => {
                        console.error("Error uploading image:", error);
                    })
                    .finally(() => {
                        setIsLoading(false);
                    });
                }, "image/png", 1.0);
            });
        } catch (error) {
            console.error("Error in handleCapture:", error);
            setIsLoading(false);
        }
    };

    return (
        <div className="main-map">
            <div className="header-section">
                <h1 className="map-title">Satellite Map</h1>
                <p className="map-subtitle">Select and analyze your area of interest</p>
            </div>

            <div className="map-section">
                <div className="container">
                    <div id="map" className="map-container"></div>
                    {showInstructions && (
                        <div className="map-overlay">
                            <div className="overlay-content">
                                <h3>How to use:</h3>
                                <p>🔍 Zoom in to maximum level (15x) for accurate analysis</p>
                                <p>📍 Center your area of interest</p>
                                <p>📸 Click "Start analysing" to process</p>
                                <button 
                                    className="close-instructions"
                                    onClick={() => setShowInstructions(false)}
                                >
                                    Got it!
                                </button>
                            </div>
                        </div>
                    )}
                    <div className="beta-banner" style={{ display: showBetaBanner ? 'flex' : 'none' }}>
                        <span className="beta-tag">BETA</span>
                        <p>This is an AI-powered analysis tool. Results may vary and should be verified.</p>
                        <button 
                            className="beta-banner-close"
                            onClick={() => setShowBetaBanner(false)}
                            aria-label="Close beta banner"
                        >
                            ×
                        </button>
                    </div>
                </div>

                <div className="controls-section">
                    <div className="coordinates-input">
                        <div className="input-group">
                            <input
                                type="number"
                                name="latitude"
                                value={coordinates.latitude}
                                onChange={handleCoordinateChange}
                                placeholder="Latitude (22.0 - 31.6)"
                                step="0.001"
                            />
                            <input
                                type="number"
                                name="longitude"
                                value={coordinates.longitude}
                                onChange={handleCoordinateChange}
                                placeholder="Longitude (25.0 - 36.9)"
                                step="0.001"
                            />
                        </div>
                        {error && <p className="error-message">{error}</p>}
                        <button 
                            onClick={handleGoToCoordinates}
                            className={`go-to-btn ${isGoToLoading ? 'loading' : ''}`}
                            disabled={isGoToLoading}
                        >
                            {isGoToLoading ? (
                                <span className="loading-spinner"></span>
                            ) : (
                                "Go to Location"
                            )}
                        </button>
                    </div>
                    <button 
                        onClick={handleCapture}
                        disabled={captureDisabled || isLoading}
                        className={`capture-btn-map ${isLoading ? 'loading' : ''} ${captureDisabled ? 'disabled' : ''}`}
                    >
                        {isLoading ? (
                            <span className="loading-spinner"></span>
                        ) : (
                            "Start analysing"
                        )}
                    </button>
                    <a href="/" className="nav-btn-map">Go to Home</a>
                </div>
            </div>
            <div id="hidden-map" className="hidden-map"></div>
        </div>
    );
};

export default Map;
