import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { NavLink } from 'react-router-dom';
import logo from '../../../public/AlphaV nobg.png';
import './Results.css';
import { FaBars, FaTimes, FaWater, FaTemperatureHigh, FaCloudRain, FaFlask, FaMapMarkerAlt, FaFileAlt, FaDownload, FaRobot, FaSeedling, FaLeaf } from 'react-icons/fa';
import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, Title, Tooltip, Legend, ArcElement } from "chart.js";
import { Bar, Pie } from 'react-chartjs-2';
import { Helmet } from 'react-helmet';

ChartJS.register(BarElement, CategoryScale, LinearScale, Title, Tooltip, Legend, ArcElement);

const Results = () => {
    const [apiData, setApiData] = useState(null);
    const [isSticky, setIsSticky] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [resultImage, setResultImage] = useState(false);
    const [opacity, setOpacity] = useState(0.7);
    const [visibleCrops, setVisibleCrops] = useState(3);
    const [report, setReport] = useState(null);
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);
    const capturedMapImage = localStorage.getItem('capturedMapImage');    
    const storedData = localStorage.getItem('mapAnalysisData');
    const analysisData = storedData ? JSON.parse(storedData) : null;
    const coordinates = analysisData?.coordinates || { latitude: 'N/A', longitude: 'N/A' };

    const regionColors = {
        "Urban": "#ff0000",
        "Barren": "#d2b48c",
        "Agriculture": "#00ff00",
        "Water": "#0000ff",
    };
    
    useEffect(() => {
        if (analysisData) {
            const timer = setTimeout(() => {
                setApiData(analysisData.analysis);
                setIsLoading(false);
            }, 3000);
            
            return () => clearTimeout(timer);
        }
        else{
            setIsLoading(true);
        }
    }, [analysisData]);

    useEffect(() => {
        const generateReport = async () => {
            if (apiData && !report && !isGeneratingReport) {
                setIsGeneratingReport(true);
                try {
                    console.log("Generating report with data:", apiData);
                    
                    const response = await axios.post(
                        'https://web-production-6017.up.railway.app/generate_report', 
                        apiData,
                        {
                            headers: {
                                'Content-Type': 'application/json'
                            }
                        }
                    );

                    console.log("Report API response:", response);
                    
                    if (response.data) {
                        setReport(response.data);
                        console.log("Report generated successfully");
                    } else {
                        console.error('Empty response from report API');
                    }
                } catch (error) {
                    console.error('Error generating report:', error);
                    
                    // Detailed error logging
                    if (error.response) {
                        console.error("Server responded with error:", error.response.status, error.response.data);
                    } else if (error.request) {
                        console.error("No response received from server:", error.request);
                    } else {
                        console.error("Error setting up request:", error.message);
                    }
                    
                    // You could set an error state here to show to the user
                    // setReportError("Failed to generate report. Please try again later.");
                } finally {
                    setIsGeneratingReport(false);
                }
            }
        };

        generateReport();
    }, [apiData, report, isGeneratingReport]);
    
    useEffect(() => {
        const handleScroll = () => {
            setIsSticky(window.scrollY > 0);
        };
        window.addEventListener("scroll", handleScroll);
        return () => {
            window.removeEventListener("scroll", handleScroll);
        };
    }, []);

    const processData = (data) => {
        if (!data) return null;
        
        // Filter out zero values and create new objects
        const filteredPercentage = Object.fromEntries(
            Object.entries(data.percentage || {}).filter(([_, value]) => value !== 0 && _ != "Background")
        );
        
        const filteredFI = Object.fromEntries(
            Object.entries(data.normalized_FI || {}).filter(([key, value]) => filteredPercentage[key] !== 0)
        );

        // Get colors for each region
        const getRegionColor = (region) => regionColors[region] || "#808080";

        return {
            barData: {
                labels: Object.keys(filteredPercentage),
                datasets: [
                    {
                        label: "Normalized Fragmentation Index",
                        data: Object.entries(filteredFI).map(([region, value]) => value * 1000),
                        backgroundColor: Object.keys(filteredPercentage).map(getRegionColor),
                        borderColor: Object.keys(filteredPercentage).map(getRegionColor),
                        borderWidth: 1,
                    },
                ],
            },
            pieData: {
                labels: Object.keys(filteredPercentage),
                datasets: [
                    {
                        data: Object.values(filteredPercentage),
                        backgroundColor: Object.keys(filteredPercentage).map(getRegionColor),
                        borderColor: '#fff',
                        borderWidth: 1,
                    },
                ],
            }
        };
    };

    const chartData = processData(apiData);
    
    const barOptions = {
        responsive: true,
        plugins: {
            legend: { position: "top", labels: { color: "white" } },
            title: { display: true, text: "Fragmentation Index by Land Type", color: "white" },
        },
        scales: {
            x: { 
                stacked: true, 
                ticks: { color: "white" },
                grid: {
                    display: false
                }
            },
            y: { 
                stacked: true, 
                ticks: { color: "white" },
                grid: {
                    display: false
                }
            },
        },
    };

    const pieOptions = {
        responsive: true,
        plugins: {
            legend: { position: "right", labels: { color: "white" } },
            title: { display: true, text: "Land Type Distribution", color: "white" },
        },
    };

    const downloadReport = () => {
        if (report) {
            // Create a blob from the report text
            const blob = new Blob([report], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'land_analysis_report.pdf';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        }
    };

    return (
        <>
        {isLoading ? (
            <div className="loading-screen">
                <div className="loading-content">
                    <img 
                        src="https://res.cloudinary.com/dqktuc5ej/image/upload/v1746497485/VID-20250506-WA0002-baousn-unscreen_fd5xyf.gif"
                        alt="Loading Animation"
                        className="loading-video"
                    />
                    <p className="loading-text">Launching Satellitor...</p>
                </div>
            </div>
        ) : (
        <>
            <Helmet>
                <script type="application/javascript">
                {`
                    (function(w,d,s,o,f,js,fjs){
                    w[o]=w[o]||function(){(w[o].q=w[o].q||[]).push(arguments);};
                    js=d.createElement(s);
                    fjs=d.getElementsByTagName(s)[0];
                    js.id=o;
                    js.src=f;
                    js.async=1;
                    js.referrerPolicy = "origin";
                    fjs.parentNode.insertBefore(js,fjs);
                    })(window,document,"script","copilot","https://script.copilot.live/v1/copilot.min.js?tkn=cat-zxscynqi");
                    copilot("init",{});
                `}
                </script>
            </Helmet>

            <nav className={isSticky ? "results-navbar sticky" : "results-navbar"}>
                <NavLink to="/" className="results-logo">
                    <img src={logo} alt="Logo" className="results-logo-img" />
                    <p className="results-title">Satellitor</p>
                </NavLink>

                <div className="results-menu">
                    
                    <ul className='results-nav-items'>
                        <li><NavLink to="/" className="results-nav-item">Home</NavLink></li>
                        <li><NavLink to="/Map" className="results-nav-item">Map</NavLink></li>
                        <li><NavLink to="#contact" className="results-nav-item">Contact</NavLink></li>
                    </ul>
                </div>
            </nav>

            <div className={isSticky ? "results-mobile-header sticky" : "results-mobile-header"}>
                <NavLink to="/" className="results-logo">
                    <img src={logo} alt="Logo" className="results-logo-img" />
                    <p className="results-title">Satellitor</p>
                </NavLink>
                <button className="results-menu-icon" onClick={() => setIsOpen(!isOpen)}>
                    {isOpen ? <FaTimes /> : <FaBars />}
                </button>
            </div>

            <nav className={isOpen ? "results-sidebar open" : "results-sidebar"}>
                <div className="results-menu-icon" onClick={() => setIsOpen(false)}>
                    <FaTimes />
                </div>
                <ul className='results-nav-items'>
                    <li><NavLink to="/" className="results-nav-item" onClick={() => setIsOpen(false)}>Home</NavLink></li>
                    <li><NavLink to="/Map" className="results-nav-item" onClick={() => setIsOpen(false)}>Map</NavLink></li>
                    <li><NavLink to="#contact" className="results-nav-item" onClick={() => setIsOpen(false)}>Contact</NavLink></li>
                </ul>
            </nav>

            <div className="Results">
                <h1 className="results-head">Results</h1>
                <hr className="results-line" />
                <div className="result-content">
                    <div className="result-info">
                        <h2 className="result-info-head">Analysis Information</h2>
                        <div className="result-info-content">
                            <ul className="result-info-list">
                                <li>
                                    <span className="result-info-type">
                                        <FaMapMarkerAlt className="info-icon" /> Location
                                    </span>
                                    <span className="result-info-text">
                                        {coordinates.latitude !== 'N/A' ? 
                                            `${coordinates.latitude.toFixed(4)}°N, ${coordinates.longitude.toFixed(4)}°E` : 
                                            'N/A'}
                                    </span>
                                </li>
                                <li>
                                    <span className="result-info-type">
                                        <FaWater className="info-icon" /> Humidity
                                    </span>
                                    <span className="result-info-text">{apiData?.humidity || 'N/A'}%</span>
                                </li>
                                <li>
                                    <span className="result-info-type">
                                        <FaTemperatureHigh className="info-icon" /> Temperature
                                    </span>
                                    <span className="result-info-text">{apiData?.temperature || 'N/A'}°C</span>
                                </li>
                                <li>
                                    <span className="result-info-type">
                                        <FaCloudRain className="info-icon" /> Rainfall
                                    </span>
                                    <span className="result-info-text">{apiData?.rainfall || 'N/A'} mm</span>
                                </li>
                                <li>
                                    <span className="result-info-type">
                                        <FaFlask className="info-icon" /> PH
                                    </span>
                                    <span className="result-info-text">{apiData.ph !== -1 ? apiData.ph : 'N/A'}</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                    


                    <div className="result-container">
                        <div className="result-img">
                            <img src={capturedMapImage} alt="result Logo" className="background" />
                            {resultImage ? (
                                <img 
                                    src={`https://satellitor.duckdns.org${apiData.mask_image}`} 
                                    alt="Result Image" 
                                    className="overlay" 
                                    style={{ opacity: opacity }}
                                />
                            ) : (
                                <img 
                                    src={`https://satellitor.duckdns.org${apiData.boundaries_image}`} 
                                    alt="result Logo" 
                                    className="overlay" 
                                />
                            )}
                        </div>
                        {resultImage && (
                            <div className="color-legend-row">
                                {Object.entries(apiData?.percentage || {}).map(([region, value]) => {
                                    if (value > 0 && region !== "Background") {
                                        return (
                                            <div key={region} className="color-legend-item">
                                                <div 
                                                    className="color-swatch" 
                                                    style={{ backgroundColor: regionColors[region] }}
                                                ></div>
                                                <span className="color-label">{region}</span>
                                            </div>
                                        );
                                    }
                                    return null;
                                })}
                            </div>
                        )}
                        <div className="buttons">
                            <button className="boundry-btn" onClick={() => setResultImage(!resultImage)}>
                                {resultImage ? "Show Boundaries" : "Show Mask Image"}
                            </button>
                            {resultImage && (
                                <div className="opacity-control">
                                    <span className="opacity-label">Adjust Mask Opacity</span>
                                    <input 
                                        type="range" 
                                        min="0" 
                                        max="1" 
                                        step="0.1" 
                                        value={opacity} 
                                        onChange={(e) => setOpacity(parseFloat(e.target.value))}
                                        className="opacity-slider"
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <div className="download-report-cta">
                    <div 
                        className="scroll-arrow"
                        onClick={() => {
                            const reportSection = document.querySelector('.report-content');
                            reportSection.scrollIntoView({ behavior: 'smooth' });
                        }}
                    >
                        <div className="arrow-content">
                            <span className="arrow-text">If You want to download Full Report</span>
                            <div className="arrow-icon">
                                <div className="arrow-line"></div>
                                <div className="arrow-head"></div>
                            </div>
                        </div>
                        <div className="arrow-glow"></div>
                    </div>
                </div>
                
                {apiData?.fertilizer && apiData.fertilizer !== 'none' && (
                    <>
                    <h1 className="results-head">Soil Analysis</h1>
                    <hr className="results-line" />
                    <div className="soil-analysis-content">
                    <div className="soil-analysis-grid">
                        <div className="fertilizer-info">
                            <h2 className="fertilizer-title">
                                <FaFlask className="section-icon" /> Recommended Fertilizer
                            </h2>
                            <div className="fertilizer-content">
                                <div className="fertilizer-header">
                                    <h3 className="fertilizer-name">{apiData.fertilizer}</h3>
                                    <div className="fertilizer-badge">
                                        <span className="badge-icon">💊</span>
                                        <span className="badge-text">Recommended</span>
                                    </div>
                                </div>
                                <div className="fertilizer-description">
                                    <div className="fertilizer-card">
                                        <div className="fertilizer-card-header">
                                            <span className="fertilizer-type">{apiData.fertilizer}</span>
                                            <div className="fertilizer-stats">
                                                {apiData.fertilizer === 'DAP' && (
                                                    <>
                                                        <span className="stat">N: 18%</span>
                                                        <span className="stat">P: 46%</span>
                                                    </>
                                                )}
                                                {apiData.fertilizer === 'Urea' && (
                                                    <span className="stat">N: 46%</span>
                                                )}
                                                {apiData.fertilizer === 'TSP' && (
                                                    <span className="stat">P: 46%</span>
                                                )}
                                                {apiData.fertilizer === 'Potassium sulfate' && (
                                                    <span className="stat">K: 50%</span>
                                                )}
                                                {apiData.fertilizer === 'Potassium chloride' && (
                                                    <span className="stat">K: 60%</span>
                                                )}
                                                {apiData.fertilizer === '28-28' && (
                                                    <>
                                                        <span className="stat">N: 28%</span>
                                                        <span className="stat">P: 28%</span>
                                                    </>
                                                )}
                                                {apiData.fertilizer === '20-20' && (
                                                    <>
                                                        <span className="stat">N: 20%</span>
                                                        <span className="stat">P: 20%</span>
                                                        <span className="stat">K: 20%</span>
                                                    </>
                                                )}
                                                {apiData.fertilizer === '17-17-17' && (
                                                    <>
                                                        <span className="stat">N: 17%</span>
                                                        <span className="stat">P: 17%</span>
                                                        <span className="stat">K: 17%</span>
                                                    </>
                                                )}
                                                {apiData.fertilizer === '15-15-15' && (
                                                    <>
                                                        <span className="stat">N: 15%</span>
                                                        <span className="stat">P: 15%</span>
                                                        <span className="stat">K: 15%</span>
                                                    </>
                                                )}
                                                {apiData.fertilizer === '14-35-14' && (
                                                    <>
                                                        <span className="stat">N: 14%</span>
                                                        <span className="stat">P: 35%</span>
                                                        <span className="stat">K: 14%</span>
                                                    </>
                                                )}
                                                {apiData.fertilizer === '14-14-14' && (
                                                    <>
                                                        <span className="stat">N: 14%</span>
                                                        <span className="stat">P: 14%</span>
                                                        <span className="stat">K: 14%</span>
                                                    </>
                                                )}
                                                {apiData.fertilizer === '10-26-26' && (
                                                    <>
                                                        <span className="stat">N: 10%</span>
                                                        <span className="stat">P: 26%</span>
                                                        <span className="stat">K: 26%</span>
                                                    </>
                                                )}
                                                {apiData.fertilizer === '10-10-10' && (
                                                    <>
                                                        <span className="stat">N: 10%</span>
                                                        <span className="stat">P: 10%</span>
                                                        <span className="stat">K: 10%</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        <p>
                                            {apiData.fertilizer === 'DAP' && 'Ideal for promoting root development and flowering in plants. Best used during early growth stages.'}
                                            {apiData.fertilizer === 'Urea' && 'Excellent for promoting vegetative growth and green foliage in plants. Perfect for leafy crops.'}
                                            {apiData.fertilizer === 'TSP' && 'Best for root development and flowering. Ideal for phosphorus-deficient soils.'}
                                            {apiData.fertilizer === 'Superphosphate' && 'Good for root development and early plant growth. Suitable for most soil types.'}
                                            {apiData.fertilizer === 'Potassium sulfate' && 'Excellent for fruit development and disease resistance. Best for fruiting plants.'}
                                            {apiData.fertilizer === 'Potassium chloride' && 'Good for overall plant health and stress resistance. Ideal for potassium-deficient soils.'}
                                            {apiData.fertilizer === '28-28' && 'Good for general plant growth and development. Suitable for most crops.'}
                                            {apiData.fertilizer === '20-20' && 'Ideal for general plant maintenance. Perfect for balanced nutrient requirements.'}
                                            {apiData.fertilizer === '17-17-17' && 'Good for general plant growth. Suitable for most garden plants.'}
                                            {apiData.fertilizer === '15-15-15' && 'Suitable for general plant growth. Good for balanced nutrition.'}
                                            {apiData.fertilizer === '14-35-14' && 'Good for flowering and fruiting. Ideal for phosphorus-demanding crops.'}
                                            {apiData.fertilizer === '14-14-14' && 'Suitable for general plant growth. Good for balanced nutrition.'}
                                            {apiData.fertilizer === '10-26-26' && 'Good for fruiting and flowering. Ideal for fruit-bearing plants.'}
                                            {apiData.fertilizer === '10-10-10' && 'Suitable for general plant maintenance. Good for balanced nutrition.'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="soil-info">
                            <h2 className="soil-info-title">
                                <FaSeedling className="section-icon" /> Soil Composition
                            </h2>
                            <div className="soil-info-grid">
                                <div className="soil-info-item">
                                    <div className="soil-info-icon">
                                        <FaLeaf className="info-icon" />
                                    </div>
                                    <div className="soil-info-content">
                                        <h3 className="soil-info-label">Soil Type</h3>
                                        <p className="soil-info-value">{apiData?.soil_type || 'N/A'}</p>
                                    </div>
                                </div>
                                <div className="soil-info-item">
                                    <div className="soil-info-icon">
                                        <FaFlask className="info-icon" />
                                    </div>
                                    <div className="soil-info-content">
                                        <h3 className="soil-info-label">Nitrogen (N)</h3>
                                        <p className="soil-info-value">{apiData?.nitrogen || 'N/A'} mg/kg</p>
                                    </div>
                                </div>
                                <div className="soil-info-item">
                                    <div className="soil-info-icon">
                                        <FaFlask className="info-icon" />
                                    </div>
                                    <div className="soil-info-content">
                                        <h3 className="soil-info-label">Phosphorus (P)</h3>
                                        <p className="soil-info-value">{apiData?.phosphorus || 'N/A'} mg/kg</p>
                                    </div>
                                </div>
                                <div className="soil-info-item">
                                    <div className="soil-info-icon">
                                        <FaFlask className="info-icon" />
                                    </div>
                                    <div className="soil-info-content">
                                        <h3 className="soil-info-label">Potassium (K)</h3>
                                        <p className="soil-info-value">{apiData?.potassium || 'N/A'} mg/kg</p>
                                    </div>
                                </div>
                                <div className="soil-info-item">
                                    <div className="soil-info-icon">
                                        <FaWater className="info-icon" />
                                    </div>
                                    <div className="soil-info-content">
                                        <h3 className="soil-info-label">Moisture</h3>
                                        <p className="soil-info-value">{apiData?.moisture ? `${apiData.moisture.toFixed(2)}%` : 'N/A'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                </>
                )}
                

                <h1 className="results-head">Analysis Chart</h1>
                <hr className="results-line" />
                <div className="chart-container">
                    <div className="chart-title">
                    
                    </div>
                    <div className="chart-content">
                        <div className="chart-wrapper">
                            {chartData ? (
                                <>
                                    <div className="bar-chart">
                                        <Bar data={chartData.barData} options={barOptions} />
                                    </div>
                                    <div className="pie-chart">
                                        <Pie data={chartData.pieData} options={pieOptions} />
                                    </div>
                                </>
                            ) : (
                                <p>Loading...</p>
                            )}
                        </div>
                    </div>
                </div>

                <h1 className="results-head">Crop Recommendation</h1>
                <hr className="results-line" />
                <div className="crops-content">
                    <div className="best-crop">
                        <h2 className="best-crop-head">Best Crop for your Land</h2>
                        {apiData?.best_crops && apiData.best_crops.length > 0 ? (
                            apiData.best_crops.map((crop) => (
                                <div className="crop-item" key={crop.crop_name}>
                                    <h3 className="crop-name">{crop.crop_name}</h3>
                                    <div className="crop-details">
                                        <strong>Temperature Range:</strong>
                                        <span>{crop.crop_data.temp_min}°C - {crop.crop_data.temp_max}°C</span>
                                    </div>
                                    <div className="crop-details">
                                        <strong>Optimal Temperature:</strong>
                                        <span>{crop.crop_data.temp_opt_min}°C - {crop.crop_data.temp_opt_max}°C</span>
                                    </div>
                                    <div className="crop-details">
                                        <strong>Rainfall Range:</strong>
                                        <span>{crop.crop_data.rainfall_min}mm - {crop.crop_data.rainfall_max}mm/year</span>
                                    </div>
                                    <div className="crop-details">
                                        <strong>Optimal Rainfall:</strong>
                                        <span>{crop.crop_data.rainfall_opt_min}mm - {crop.crop_data.rainfall_opt_max}mm/year</span>
                                    </div>
                                    <div className="crop-details">
                                        <strong>PH Range:</strong>
                                        <span>{crop.crop_data.ph_min} - {crop.crop_data.ph_max}</span>
                                    </div>
                                    <div className="crop-details">
                                        <strong>Optimal PH Range:</strong>
                                        <span>{crop.crop_data.ph_opt_min} - {crop.crop_data.ph_opt_max}</span>
                                    </div>
                                    <div className="crop-details">
                                        <strong>Scientific Name:</strong>
                                        <span>{crop.crop_data.scientific_name}</span>
                                    </div>
                                    <div className="crop-details">
                                        <strong>Category:</strong>
                                        <span>{crop.crop_data.category}</span>
                                    </div>
                                    <div className="crop-details">
                                        <strong>Characteristics:</strong>
                                        <span>{crop.crop_data.notes}</span>
                                    </div>
                                    <div className="crop-desc">
                                        <strong>Important Notes:</strong> {crop.crop_notes}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="empty-state best-crop-empty">
                                <div className="empty-state-icon"></div>
                                <h3 className="empty-state-title">No Optimal Crops Found</h3>
                                <p className="empty-state-message">
                                    Based on the current land conditions, we couldn't find any crops that would be optimal for cultivation. This could be due to extreme weather conditions, soil composition, or other environmental factors.
                                </p>
                                <div className="empty-state-suggestion">
                                    Consider improving soil conditions or exploring alternative land use options
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="normal-crops">
                        <h2 className="normal-crops-head">Alternative Crops</h2>
                        <div className="crop-container-normal">
                            {apiData?.normal_crops && apiData.normal_crops.length > 0 ? (
                                <>
                                    {apiData.normal_crops.slice(0, visibleCrops).map((crop, index) => (
                                        <div className="normal-crop-item" key={index}>
                                            <h3 className="normal-crop-name">{crop.crop_name}</h3>
                                            <span className="normal-crop-category">{crop.crop_data.category}</span>
                                            <div className="normal-crop-grid">
                                                <div className="normal-crop-detail">
                                                    <span className="normal-crop-detail-title">Temperature Range</span>
                                                    <span className="normal-crop-detail-value">{crop.crop_data.temp_min}°C - {crop.crop_data.temp_max}°C</span>
                                                </div>
                                                <div className="normal-crop-detail">
                                                    <span className="normal-crop-detail-title">Rainfall Range</span>
                                                    <span className="normal-crop-detail-value">{crop.crop_data.rainfall_min}mm - {crop.crop_data.rainfall_max}mm/year</span>
                                                </div>
                                                <div className="crop-details">
                                                    <strong>PH Range:</strong>
                                                    <span>{crop.crop_data.ph_min} - {crop.crop_data.ph_max}</span>
                                                </div>
                                                <div className="crop-details">
                                                    <strong>Scientific Name:</strong>
                                                    <span>{crop.crop_data.scientific_name}</span>
                                                </div>
                                            </div>
                                            <div className="normal-crop-notes">
                                                <p className="normal-crop-notes-title">Important Notes</p>
                                                <p className="normal-crop-notes-text">{crop.crop_notes}</p>
                                            </div>
                                        </div>
                                    ))}
                                    {visibleCrops < apiData.normal_crops.length && (
                                        <button 
                                            className="show-more-btn"
                                            onClick={() => setVisibleCrops(prev => Math.min(prev + 3, apiData.normal_crops.length))}
                                        >
                                            Show More
                                        </button>
                                    )}
                                </>
                            ) : (
                                <div className="empty-state normal-crops-empty">
                                    <div className="empty-state-icon"></div>
                                    <h3 className="empty-state-title">No Alternative Crops Available</h3>
                                    <p className="empty-state-message">
                                        We couldn't find any suitable alternative crops for your land at this time. This might be due to specific environmental conditions or limitations in the current analysis.
                                    </p>
                                    <div className="empty-state-suggestion">
                                        Try adjusting your search parameters or consult with agricultural experts
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <h1 className="results-head">Land Analysis Report</h1>
                <hr className="results-line" />
                <div className="report-content">
                    <div className="report-container">
                        <div className="report-body">
                            <div className="report-card">
                                <div className="report-icon-wrapper">
                                    <FaRobot className="report-icon" />
                                </div>
                                <h3 className="report-card-title">AI Land Analysis Report</h3>
                                <p className="report-card-description">
                                    Get a detailed analysis of your land including soil composition, 
                                    environmental factors, and agricultural recommendations. Our AI will 
                                    process your data and generate a comprehensive report.
                                </p>
                                <button 
                                    className={`download-report-btn ${report ? 'active' : 'disabled'}`}
                                    onClick={downloadReport}
                                    disabled={!report}
                                    title={report ? "Download Report" : "Generating Report..."}
                                >
                                    {report ? (
                                        <>
                                            <FaDownload className="download-icon" />
                                            Download PDF
                                        </>
                                    ) : (
                                        <>
                                            <div className="loading-dots">
                                                <span></span>
                                                <span></span>
                                                <span></span>
                                            </div>
                                            Generating Report
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>



            <div className="contact" id="contact">
                <h2 className="contact-title">Contact Us</h2>
                
                <p className="contact-text">Have any questions or feedback? Feel free to reach out to us.</p>
                
                <div className="contact-container">
                    <form className="contact-form">
                        <input type="text" placeholder="Your Name" required />
                        <input type="email" placeholder="Your Email" required />
                        <textarea placeholder="Your Message" rows="5" required></textarea>
                        <button type="submit">Send Message</button>
                    </form>
            
                    <div className="contact-info">
                        <p>Email: <a href="mailto:satalitor@gmail.com">virtufirm.org@gmail.com</a></p>
                        <p>Phone: +20 128 696 4627</p>
                    </div>
                </div>
                <p className="last">This Team is a Part of <a href="https://www.linkedin.com/company/virtufirm" className="virtu">VirtuFirm </a></p>
            </div>
        </>
        )}    
        {/* Custom Chatbot Button with Banner */}
        <div className="custom-chatbot-banner">
        Chat with me
        </div>
        <div className="custom-chatbot-container">
          <button className="custom-chatbot-button">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="9" fill="#1a0136"/>
              <text x="10" y="15" textAnchor="middle" fontSize="14" fill="#fff">AI</text>
            </svg>
          </button>
        </div>
    </>
  );
};

export default Results;
