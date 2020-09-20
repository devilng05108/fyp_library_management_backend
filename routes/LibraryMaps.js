const Mutler = require("../utils/mutler.util");
const LibraryMapController = require("../controller/LibraryMapController");

const {Router} = require("express");
const libraryMaps = Router();

libraryMaps.get('/get-library-maps', LibraryMapController.getLibraryMaps);

libraryMaps.post('/update-library-map', Mutler.uploadImageFile.single('file'), LibraryMapController.updateLibraryMap);

libraryMaps.post('/delete-library-map',LibraryMapController.deleteLibraryMap);

module.exports = libraryMaps;