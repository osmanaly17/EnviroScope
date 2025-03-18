// Initialize the map and center it
Map.setCenter(74.3587, 31.5204, 12);

// Define a default Region of Interest (ROI) for Lahore
var roi = ee.Geometry.Rectangle([74.20, 31.40, 74.50, 31.60]);
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

// ROI Input Fields
var roiLabel = ui.Label('Region of Interest:');
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

// Main control panel
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

// Define AOI for Lahore
var lahoreAOI = ee.Geometry.Polygon(
  [[[74.20, 31.60], [74.20, 31.40], [74.50, 31.40], [74.50, 31.60]]]
);

// Function to process and display results
function processAOI(aoi, label) {
  var image = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
    .filterDate('2022-05-01', '2022-12-31')
    .filterBounds(aoi)
    .median();

  var visualization = {
    bands: ['SR_B4', 'SR_B3', 'SR_B2'],
    min: 0.0,
    max: 0.3,
  };

  Map.addLayer(image, visualization, label + ' - True Color (432)', false);

  // NDVI Calculation
  var ndvi = image.normalizedDifference(['SR_B5', 'SR_B4']).rename('NDVI');
  Map.addLayer(ndvi, {min: -1, max: 1, palette: ['blue', 'white', 'green']}, label + ' - NDVI', false);

  // LST Calculation
  var thermal = image.select('ST_B10').rename('thermal');
  var lst = thermal.expression(
    '(tb / (1 + (0.00115 * (tb / 0.48359547432)) * log(0.986))) - 273.15',
    {'tb': thermal.select('thermal')}
  ).rename('LST');

  var lst_vis = {
    min: 25,
    max: 50,
    palette: [
      '040274', '0502a3', '0502b8', '0602ff', '235cb1', '30c8e2',
      '3be285', '86e26f', 'b5e22e', 'd6e21f', 'fff705', 'ffd611',
      'ffb613', 'ff8b13', 'ff6e08', 'ff500d', 'ff0000'
    ]
  };

  Map.addLayer(lst, lst_vis, label + ' - LST', false);
  Map.centerObject(aoi, 10);
}

// Run the function for Lahore
processAOI(lahoreAOI, 'Lahore');
