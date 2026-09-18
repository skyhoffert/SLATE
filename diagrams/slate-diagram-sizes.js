// Native pixel size of each diagrams/*.html file, i.e. the (w, h) passed to
// `new Circuit(w, h)` in that file - lets <slate-diagram src="..."> know its
// aspect ratio without needing same-origin access into the iframe (which
// file:// blocks). Keep in sync by running diagrams/update-diagram-sizes.sh.
const DIAGRAM_SIZES = {
  'diagrams/fourwire_resistance_measurement.html': [400, 300],
  'diagrams/ptc_circuit_ammeter.html': [250, 130],
  'diagrams/rc_network.html': [400, 180],
  'diagrams/twowire_resistance_measurement.html': [400, 200],
  'diagrams/twowire_rtd_meas.html': [500, 300],
  'diagrams/voltage_divider.html': [305, 180],
};
