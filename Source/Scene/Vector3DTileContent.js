/*global define*/
define([
    '../Core/BoundingSphere',
    '../Core/Cartesian3',
    '../Core/Cartographic',
    '../Core/Color',
    '../Core/ColorGeometryInstanceAttribute',
    '../Core/defaultValue',
    '../Core/defined',
    '../Core/destroyObject',
    '../Core/defineProperties',
    '../Core/DeveloperError',
    '../Core/Ellipsoid',
    '../Core/GeometryInstance',
    '../Core/getMagic',
    '../Core/getStringFromTypedArray',
    '../Core/loadArrayBuffer',
    '../Core/PolygonGeometry',
    '../Core/PolylineGeometry',
    '../Core/Request',
    '../Core/RequestScheduler',
    '../Core/RequestType',
    '../ThirdParty/when',
    './Cesium3DTileContentState',
    './GroundPrimitive',
    './LabelCollection',
    './PerInstanceColorAppearance',
    './PolylineColorAppearance',
    './Primitive'
], function(
    BoundingSphere,
    Cartesian3,
    Cartographic,
    Color,
    ColorGeometryInstanceAttribute,
    defaultValue,
    defined,
    destroyObject,
    defineProperties,
    DeveloperError,
    Ellipsoid,
    GeometryInstance,
    getMagic,
    getStringFromTypedArray,
    loadArrayBuffer,
    PolygonGeometry,
    PolylineGeometry,
    Request,
    RequestScheduler,
    RequestType,
    when,
    Cesium3DTileContentState,
    GroundPrimitive,
    LabelCollection,
    PerInstanceColorAppearance,
    PolylineColorAppearance,
    Primitive) {
    'use strict';

    /**
     * @alias Vector3DTileContent
     * @constructor
     *
     * @private
     */
    function Vector3DTileContent(tileset, tile, url) {
        this._labelCollection = undefined;
        this._primitives = [];
        this._url = url;
        this._tileset = tileset;
        this._tile = tile;

        /**
         * The following properties are part of the {@link Cesium3DTileContent} interface.
         */
        this.state = Cesium3DTileContentState.UNLOADED;
        this.contentReadyToProcessPromise = when.defer();
        this.readyPromise = when.defer();
        this.batchTableResources = undefined;
        this.featurePropertiesDirty = false;
        this.boundingSphere = tile.contentBoundingVolume.boundingSphere;
    }

    defineProperties(Vector3DTileContent.prototype, {
        /**
         * Part of the {@link Cesium3DTileContent} interface.
         */
        featuresLength : {
            get : function() {
                // TODO: implement batchTable for vctr tile format
                return 0;
            }
        },

        /**
         * Part of the {@link Cesium3DTileContent} interface.
         */
        innerContents : {
            get : function() {
                return undefined;
            }
        }
    });

    /**
     * Part of the {@link Cesium3DTileContent} interface.
     */
    Vector3DTileContent.prototype.hasProperty = function(name) {
        // TODO: implement batchTable for vctr tile format
        return false;
    };

    /**
     * Part of the {@link Cesium3DTileContent} interface.
     */
    Vector3DTileContent.prototype.getFeature = function(batchId) {
        // TODO: implement batchTable for vctr tile format
        return undefined;
    };

    /**
     * Part of the {@link Cesium3DTileContent} interface.
     */
    Vector3DTileContent.prototype.request = function() {
        var that = this;

        var distance = this._tile.distanceToCamera;
        var promise = RequestScheduler.schedule(new Request({
            url : this._url,
            server : this._tile.requestServer,
            requestFunction : loadArrayBuffer,
            type : RequestType.TILES3D,
            distance : distance
        }));
        if (defined(promise)) {
            this.state = Cesium3DTileContentState.LOADING;
            promise.then(function(arrayBuffer) {
                if (that.isDestroyed()) {
                    return when.reject('tileset is destroyed');
                }
                that.initialize(arrayBuffer);
            }).otherwise(function(error) {
                that.state = Cesium3DTileContentState.FAILED;
                that.readyPromise.reject(error);
            });
        }
    };

    //var sizeOfUint32 = Uint32Array.BYTES_PER_ELEMENT;

    /**
     * Part of the {@link Cesium3DTileContent} interface.
     */
    Vector3DTileContent.prototype.initialize = function(arrayBuffer, byteOffset) {
        byteOffset = defaultValue(byteOffset, 0);

        var uint8Array = new Uint8Array(arrayBuffer);
        /*
        var magic = getMagic(uint8Array, byteOffset);
        if (magic !== 'vctr') {
            throw new DeveloperError('Invalid Vector tile.  Expected magic=vctr.  Read magic=' + magic);
        }

        var view = new DataView(arrayBuffer);
        byteOffset += sizeOfUint32;  // Skip magic number

        //>>includeStart('debug', pragmas.debug);
        var version = view.getUint32(byteOffset, true);
        if (version !== 1) {
            throw new DeveloperError('Only Vector tile version 1 is supported.  Version ' + version + ' is not.');
        }
        //>>includeEnd('debug');
        byteOffset += sizeOfUint32;

        // Skip byteLength
        byteOffset += sizeOfUint32;
        */

        var text = getStringFromTypedArray(uint8Array, byteOffset);
        var json = JSON.parse(text);

        /*
        var labelCollection = new LabelCollection();

        var length = json.length;
        for (var i = 0; i < length; ++i) {
            var label = json[i];
            var labelText = label.text;
            var cartographicArray = label.position;

            var lon = cartographicArray[0];
            var lat = cartographicArray[1];
            var alt = defaultValue(cartographicArray[2], 0.0);

            var cartographic = new Cartographic(lon, lat, alt);
            var position = Ellipsoid.WGS84.cartographicToCartesian(cartographic);

            labelCollection.add({
                text : labelText,
                position : position
            });
        }
        */

        var polygonInstances = [];
        var outlineInstances = [];

        var minHeight = Number.POSITIVE_INFINITY;
        var maxHeight = Number.NEGATIVE_INFINITY;

        var polygons = json.polygons;
        var length = polygons.length;

        var color = Color.fromRandom().withAlpha(0.5);

        for (var i = 0; i < length; ++i) {
            var polygon = polygons[i];
            polygonInstances.push(new GeometryInstance({
                /*
                geometry : PolygonGeometry.fromPositions({
                    positions : polygon.positions,
                    vertexFormat : PerInstanceColorAppearance.VERTEX_FORMAT
                }),
                */
                geometry : polygon.geometry,
                attributes: {
                    //color: ColorGeometryInstanceAttribute.fromColor(Color.RED.withAlpha(0.5))
                    color: ColorGeometryInstanceAttribute.fromColor(color)
                }
            }));
            /*
            outlineInstances.push(new GeometryInstance({
                geometry : new PolylineGeometry({
                    positions : polygon.positions,
                    width : 1.0,
                    vertexFormat : PolylineColorAppearance.VERTEX_FORMAT
                }),
                attributes: {
                    color: ColorGeometryInstanceAttribute.fromColor(Color.RED)
                }
            }));
            */

            minHeight = Math.min(minHeight, defaultValue(polygon.minimumHeight, minHeight));
            maxHeight = Math.max(maxHeight, defaultValue(polygon.maximumHeight, maxHeight));
        }

        /*
        this._primitives.push(new Primitive({
            geometryInstances : polygonInstances,
            appearance : new PerInstanceColorAppearance({
                closed : true,
                translucent : true
            }),
            asynchrounous : false
        }));

        this._primitives.push(new Primitive({
            geometryInstances : outlineInstances,
            appearance : new PolylineColorAppearance(),
            asynchrounous : false
        }));
        */

        this._primitives.push(new GroundPrimitive({
            //debugShowShadowVolume : true,
            geometryInstances : polygonInstances,
            asynchronous : false,
            _minimumHeight : minHeight !== Number.POSITIVE_INFINITY ? minHeight : undefined,
            _maximumHeight : maxHeight !== Number.NEGATIVE_INFINITY ? maxHeight : undefined,
            _precreated : true
        }));

        this.state = Cesium3DTileContentState.PROCESSING;
        this.contentReadyToProcessPromise.resolve(this);

        //this._labelCollection = labelCollection;
        this.state = Cesium3DTileContentState.READY;
        this.readyPromise.resolve(this);
    };

    /**
     * Part of the {@link Cesium3DTileContent} interface.
     */
    Vector3DTileContent.prototype.applyDebugSettings = function(enabled, color) {
    };

    /**
     * Part of the {@link Cesium3DTileContent} interface.
     */
    Vector3DTileContent.prototype.update = function(tileset, frameState) {
        //this._labelCollection.update(frameState);
        var primitives = this._primitives;
        var length = primitives.length;
        for (var i = 0; i < length; ++i) {
            primitives[i].update(frameState);
        }
    };

    /**
     * Part of the {@link Cesium3DTileContent} interface.
     */
    Vector3DTileContent.prototype.isDestroyed = function() {
        return false;
    };

    /**
     * Part of the {@link Cesium3DTileContent} interface.
     */
    Vector3DTileContent.prototype.destroy = function() {
        this._labelCollection = this._labelCollection && this._labelCollection.destroy();
        return destroyObject(this);
    };

    return Vector3DTileContent;
});
