// Initialize the map and center it
Map.setCenter(74.3587, 31.5204, 12);
// Define a default Region of Interest (ROI)
var roi = ee.Geometry.Rectangle([74.30, 31.45, 74.40, 31.55]);
Map.setCenter(74.3587, 31.5204, 12);
Map.centerObject(roi, 12);
// Define date options
var dateOptions = [
'2020-01-01 to 2020-06-30',
'2020-07-01 to 2020-12-31',
'2021-01-01 to 2021-06-30',
'2021-07-01 to 2021-12-31'
];
// Define index options
var indexOptions = ['Chlorophyll-a', 'Turbidity', 'Total Suspended Solids (TSS)', 'RGB'];
// UI components
var dateSelect = ui.Select({items: dateOptions, value: dateOptions[0], style: {width: '250px'}});
var indexSelect = ui.Select({items: indexOptions, value: indexOptions[1], style: {width: '250px'}});
// Add input fields for ROIvar roiLabel = ui.Label('Region of Interest:');
var drawButton = ui.Button({
label: 'Draw ROI',
onClick: function() {
Map.drawingTools().setShape('polygon');
Map.drawingTools().setDrawModes(['polygon']);
Map.drawingTools().draw();
}
});
// Clear ROI button
var clearRoiButton = ui.Button({
label: 'Clear ROI',
onClick: function() {
roi = null;
Map.drawingTools().clear();
ui.root.clear();
ui.root.add(controlPanel);
}
});
// Main panel for user controls
var controlPanel = ui.Panel({
widgets: [
ui.Label('Select Date Range:'),
dateSelect,
ui.Label('Select Index to Visualize:'),
indexSelect,
roiLabel,
drawButton,
clearRoiButton,
ui.Button({
label: 'RUN',
onClick: function() {
displayVisualization();
}
})
],
style: {width: '300px', position: 'top-left'}
});
ui.root.add(controlPanel);
// ***************************************************************************// LST, UHI, and UTFVI Script
// AOI for Lahore (adjust with precise coordinates)
var lahoreAOI = ee.Geometry.Polygon(
[[[74.0584, 31.5497], [74.0584, 31.4749], [74.3584, 31.4749], [74.3584, 31.5497]]]);
var startDate = '2022-05-01';
var endDate = '2022-12-31';
// Applies scaling factors to image bands
function applyScaleFactors(image) {
var opticalBands = image.select('SR_B.').multiply(0.0000275).add(-0.2);
var thermalBands = image.select('ST_B.*').multiply(0.00341802).add(149.0);
return image.addBands(opticalBands, null, true)
.addBands(thermalBands, null, true);
}
// Cloud masking function
function maskL8sr(col) {
var cloudShadowBitMask = (1 << 3);
var cloudsBitMask = (1 << 5);
var qa = col.select('QA_PIXEL');
var mask = qa.bitwiseAnd(cloudShadowBitMask).eq(0)
.and(qa.bitwiseAnd(cloudsBitMask).eq(0));
return col.updateMask(mask);
}
// Function to process and display results for a given AOI
function processAOI(aoi, label) {
var image = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
.filterDate(startDate, endDate)
.filterBounds(aoi)
.map(applyScaleFactors)
.map(maskL8sr)
.median();
var visualization = {
bands: ['SR_B4', 'SR_B3', 'SR_B2'],
min: 0.0,
max: 0.3,
};
Map.addLayer(image, visualization, label + ' - True Color (432)', false);// NDVI Calculation
var ndvi = image.normalizedDifference(['SR_B5', 'SR_B4']).rename('NDVI');
Map.addLayer(ndvi, {min: -1, max: 1, palette: ['blue', 'white', 'green']}, label + ' - NDVI', false);
// NDVI statistics
var ndvi_min = ee.Number(ndvi.reduceRegion({
reducer: ee.Reducer.min(),
geometry: aoi,
scale: 30,
maxPixels: 1e9
}).values().get(0));
var ndvi_max = ee.Number(ndvi.reduceRegion({
reducer: ee.Reducer.max(),
geometry: aoi,
scale: 30,
maxPixels: 1e9
}).values().get(0));
// Fraction of Vegetation
var fv = (ndvi.subtract(ndvi_min).divide(ndvi_max.subtract(ndvi_min))).pow(ee.Number(2))
.rename('FV');
var em = fv.multiply(ee.Number(0.004)).add(ee.Number(0.986)).rename('EM');
// Thermal Band for LST Calculation
var thermal = image.select('ST_B10').rename('thermal');
// LST Calculation using thermal band and emissivity
var lst = thermal.expression(
'(tb / (1 + (0.00115 * (tb / 0.48359547432)) * log(em))) - 273.15',
{'tb': thermal.select('thermal'), 'em': em}).rename('LST');
var lst_vis = {
min: 25,
max: 50,
palette: [
'040274', '040281', '0502a3', '0502b8', '0502ce', '0502e6',
'0602ff', '235cb1', '307ef3', '269db1', '30c8e2', '32d3ef',
'3be285', '3ff38f', '86e26f', '3ae237', 'b5e22e', 'd6e21f',
'fff705', 'ffd611', 'ffb613', 'ff8b13', 'ff6e08', 'ff500d',
'ff0000', 'de0101', 'c21301', 'a71001', '911003'
]
};Map.addLayer(lst, lst_vis, label + ' - LST', false);
Map.centerObject(aoi, 10);
// UHI Calculation
var lst_mean = ee.Number(lst.reduceRegion({
reducer: ee.Reducer.mean(),
geometry: aoi,
scale: 30,
maxPixels: 1e9
}).values().get(0));
var lst_std = ee.Number(lst.reduceRegion({
reducer: ee.Reducer.stdDev(),
geometry: aoi,
scale: 30,
maxPixels: 1e9
}).values().get(0));
print(label + ' - Mean LST:', lst_mean);
print(label + ' - STD LST:', lst_std);
var uhi = lst.subtract(lst_mean).divide(lst_std).rename('UHI');
var uhi_vis = {
min: -4,
max: 4,
palette: ['313695', '74add1', 'fed976', 'feb24c', 'fd8d3c', 'fc4e2a', 'e31a1c', 'b10026']
};
Map.addLayer(uhi, uhi_vis, label + ' - UHI', false);
// UTFVI Calculation
var utfvi = lst.subtract(lst_mean).divide(lst).rename('UTFVI');
var utfvi_vis = {
min: -1,
max: 0.3,
palette: ['313695', '74add1', 'fed976', 'feb24c', 'fd8d3c', 'fc4e2a', 'e31a1c', 'b10026']
};
Map.addLayer(utfvi, utfvi_vis, label + ' - UTFVI', false);
}
// Function to filter and process the collection based on date range
function getFilteredCollection(start, end) {var region = roi || Map.getBounds(true);
return ee.ImageCollection('COPERNICUS/S2')
.filterBounds(region)
.filterDate(start, end);
}
// Function to compute the selected index
function computeIndex(image, index) {
if (index === 'Chlorophyll-a') {
return image.expression(
'((B3 - B5) / (B4 + B5))', {
'B3': image.select('B3'),
'B4': image.select('B4'),
'B5': image.select('B5')
}).rename('Chlorophyll-a');
}
if (index === 'Turbidity') {
return image.expression(
'((B4 / B5) - 1)', {
'B4': image.select('B4'),
'B5': image.select('B5')
}).rename('Turbidity');
}
if (index === 'Total Suspended Solids (TSS)') {
return image.expression(
'((B3 / B2) - 1)', {
'B2': image.select('B2'),
'B3': image.select('B3')
}).rename('TSS');
}
return image.select(['B4', 'B3', 'B2']); // Default: RGB
}
// Function to visualize the selected index and timelapse
function displayVisualization() {
var selectedDateRange = dateSelect.getValue();
var selectedIndex = indexSelect.getValue();
var startEnd = selectedDateRange.split(' to ');
var startDate = ee.Date(startEnd[0]);
var endDate = ee.Date(startEnd[1]);
// Get the filtered collection
var collection = getFilteredCollection(startDate, endDate);// Compute the selected index
var processedCollection = collection.map(function(image) {
return computeIndex(image, selectedIndex)
.set('system:time_start', image.get('system:time_start'));
});
// Display a time-series chart
var chart = ui.Chart.image.series({
imageCollection: processedCollection,
region: roi || Map.getBounds(true),
reducer: ee.Reducer.mean(),
scale: 500,
xProperty: 'system:time_start'
}).setOptions({
title: selectedIndex + ' Time-Series',
hAxis: {title: 'Date'},
vAxis: {title: selectedIndex},
lineWidth: 2,
pointSize: 4
});
print(chart);
// Generate a timelapse GIF
var visParams = {min: 0, max: 10, palette: ['blue', 'green', 'red']};
if (selectedIndex === 'RGB') {
visParams = {bands: ['B4', 'B3', 'B2'], min: 0, max: 3000};
} else if (selectedIndex === 'Chlorophyll-a') {
visParams = {min: 0, max: 0.2, palette: ['blue', 'green', 'yellow']};
} else if (selectedIndex === 'Turbidity') {
visParams = {min: -0.5, max: 2, palette: ['blue', 'green', 'red']};
} else if (selectedIndex === 'Total Suspended Solids (TSS)') {
visParams = {min: 0, max: 5, palette: ['yellow', 'green', 'red']};
}
var gif = processedCollection.getVideoThumbURL({
dimensions: 600,
region: roi || Map.getBounds(true),
framesPerSecond: 5,
min: visParams.min,
max: visParams.max,
palette: visParams.palette
});print('Time-Lapse GIF URL: ', gif);
}
// Run the function for Lahore (or region from the user)
processAOI(lahoreAOI, 'Lahore');
