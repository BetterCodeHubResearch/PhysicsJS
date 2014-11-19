/*
 * @requires renderers/canvas
 */
/**
 * class DebugRenderer < Renderer
 *
 * Physics.renderer('debug')
 *
 * Extends canvas renderer with special debugging functionality.
 *
 * Additional config options:
 *
 * - metaEl: HTMLElement to write meta information like FPS and IPF into. (default: autogenerated)
 * - offset: Offset the shapes by this amount. (default: `{ x: 0, y: 0 }`)
 * - styles: Styles to use to draw the shapes. (see below)
 * - drawAABB: whether or not to draw bounding boxes. (default: `true`)
 * - drawRealPosition: whether or not to draw the non-interpolated position of bodies. (default: `false`)
 * - drawIntervals: whether or not to draw the broadphase (sweep-prune) intervals. (default: `false`)
 * - drawContacts: whether or not to draw contact points. (default: `false`)
 * - aabbColor: the color of AABBs
 * - realBodyStyle: styles used to draw the image of the body at its true non-interpolated position
 * - intervalMinColor: color of interval minima
 * - intervalMaxColor: color of interval maxima
 * - mtvColor: color of minimum transit vector for contacts (overlaps)
 * - contactColor: color of contact points
 *
 * The styles property should contain _default_ styles for each shape you want to draw.
 *
 * Example:
 *
 * ```javascript
 * styles: {
 *
 *    'circle' : {
 *        strokeStyle: '#542437',
 *        lineWidth: 1,
 *        fillStyle: '#542437',
 *        angleIndicator: 'white'
 *    },
 *
 *    'convex-polygon' : {
 *        strokeStyle: '#542437',
 *        lineWidth: 1,
 *        fillStyle: '#542437',
 *        angleIndicator: 'white'
 *    }
 * }
 * ```
 **/
Physics.renderer('debug', 'canvas', function( parent, proto ){

    if ( !document ){
        // must be in node environment
        return {};
    }

    var defaults = {

        // the element to place meta data into
        metaEl: null,
        offset: { x: 0, y: 0 },
        // draw aabbs of bodies for debugging
        drawAABB: true,
        drawRealPosition: false,
        drawIntervals: false,
        drawContacts: false,

        // *** colors
        // color of the aabbs
        aabbColor: 'rgba(0, 0, 255, 0.1)',
        // styles used to draw the image of the body at its true non-interpolated position
        realBodyStyle: 'rgba(255, 0, 0, 0.5)',
        // colors for intervals
        intervalMinColor: 'rgba( 0, 0, 200, 0.1 )',
        intervalMaxColor: 'rgba( 200, 0, 0, 0.1 )',

        // contacts
        mtvColor: '#c00',
        contactColor: '#0c0'
    };

    return {

        // extended
        init: function( options ){

            var self = this;

            // call parent init
            parent.init.call(this, options);

            this.options.defaults( defaults, true );
            this.options( options, true );

            // init debug layer
            this.addLayer('debug', null, {
                zIndex: 2
            });

            this.layer('debug').render = function(){

                var intr, i, l, cols, xy;

                this.el.width = this.el.width;

                if ( self.options.drawIntervals && self._intervals ){
                    for ( xy = 0; xy < 2; xy++ ){
                        intr = self._intervals[ xy ];
                        for ( i = 0, l = intr.length; i < l; i++ ){

                            self.drawInterval( intr[ i ], this.ctx );
                        }
                    }
                }

                if ( self.options.drawContacts && self._collisions ){
                    cols = self._collisions;
                    for ( i = 0, l = cols.length; i < l; i++ ){
                        self.drawContact( cols[ i ], this.ctx );
                    }
                }
            };

            if ( window.dat ){
                this.initGui();
            }
        },

        connect: function( world ){

            world.on('sweep-prune:intervals', this.storeIntervals, this );
            world.on('collisions:detected', this.storeCollisions, this );
            world.on('render', this.reset, this);

            this.updateGui();
        },

        disconnect: function( world ){

            world.off('sweep-prune:intervals', this.storeIntervals, this );
            world.off('collisions:detected', this.storeCollisions, this );
            world.off('render', this.reset, this);
        },

        storeIntervals: function( intervals ){

            this._intervals = intervals;
        },

        storeCollisions: function( data ){

            this._collisions = data.collisions;
        },

        reset: function(){

            this._intervals = false;
            this._collisions = false;
        },

        drawInterval: function( intr, ctx ){

            var scratch = Physics.scratchpad()
                ,opts = this.options
                ,from = scratch.vector().set( intr.val.x, 0 )
                ,to = scratch.vector().set( intr.val.x, intr.tracker.body.state.pos.y )
                ;

            this.drawLine( from, to, opts[ intr.type ? 'intervalMaxColor' : 'intervalMinColor' ], ctx );
            this.drawCircle( from.x, from.y, 4, opts[ intr.type ? 'intervalMaxColor' : 'intervalMinColor' ], ctx );

            from.set( 0, intr.val.y );
            to.set( intr.tracker.body.state.pos.x, intr.val.y );

            this.drawLine( from, to, opts[ intr.type ? 'intervalMaxColor' : 'intervalMinColor' ], ctx );
            this.drawCircle( from.x, from.y, 4, opts[ intr.type ? 'intervalMaxColor' : 'intervalMinColor' ], ctx );

            scratch.done();
        },

        drawContact: function( c, ctx ){

            var scratch = Physics.scratchpad()
                ,from = scratch.vector().clone( c.pos ).vadd( c.bodyA.state.pos )
                ,to = scratch.vector().clone( from ).vsub( scratch.vector().clone( c.mtv ) )
                ,opts = this.options
                ;

            this.drawLine( from, to, opts.mtvColor, ctx );
            this.drawCircle( from.x, from.y, 2, opts.contactColor, ctx );

            scratch.done();
        },

        initGui: function(){

            var self = this
                ,gui = this.gui = new window.dat.GUI({ autoPlace: false })
                ,el = document.getElementById('my-gui-container')
                ,op = this.options
                ,getset
                ,f
                ;

            getset = {
                get timestep(){
                    return self._world ? self._world.timestep() : 6;
                }
                ,set timestep( dt ){
                    if ( self._world ) {
                        self._world.timestep( dt );
                    }
                }
                ,get maxIPF(){
                    return self._world ? self._world.options.maxIPF : 16;
                }
                ,set maxIPF( m ){
                    if ( self._world ){
                        self._world.options({ maxIPF: m });
                    }
                }
            };

            function pauseWorld(){
                if ( self._world ){
                    if ( self._world.isPaused() ){
                        self._world.unpause();
                    } else {
                        self._world.pause();
                    }
                }
            }

            f = gui.addFolder( 'General' );
            f.add( getset, 'timestep', 1, 20).step( 1 );
            f.add( getset, 'maxIPF', 1, 100).step( 1 );
            f.add( { pause: pauseWorld }, 'pause');
            f.open();

            f = gui.addFolder( 'Draw Options' );
            f.add( op, 'drawAABB' );
            f.add( op, 'drawRealPosition' );
            f.add( op, 'drawIntervals' );
            f.add( op, 'drawContacts' );
            f.open();

            f = gui.addFolder( 'Colors' );
            f.addColor( op, 'aabbColor' );
            f.addColor( op, 'realBodyStyle' );
            f.addColor( op, 'intervalMinColor' );
            f.addColor( op, 'intervalMaxColor' );
            f.addColor( op, 'mtvColor' );
            f.addColor( op, 'contactColor' );

            gui.domElement.style.zIndex = '100';
            gui.domElement.style.position = 'absolute';
            gui.domElement.style.top = '0';
            gui.domElement.style.left = '0';
            this.el.parentNode.appendChild( gui.domElement );
        },

        updateGui: function(){
            var gui = this.gui;
            // Iterate over all controllers
            for (var i in gui.__controllers) {
                gui.__controllers[i].updateDisplay();
            }
        },

        drawBody: function( body, view, ctx, offset ){

            var pos = body.state.pos
                ,v = body.state.vel
                ,t = this._interpolateTime || 0
                ,x
                ,y
                ,ang
                ,aabb
                ;

            offset = offset || this.options.offset;
            ctx = ctx || this.ctx;

            // interpolate positions
            x = pos.x + offset.x + v.x * t;
            y = pos.y + offset.y + v.y * t;
            ang = body.state.angular.pos + body.state.angular.vel * t;

            ctx.save();
            ctx.translate( x, y );
            ctx.rotate( ang );
            ctx.drawImage(view, -view.width/2, -view.height/2, view.width, view.height);
            ctx.restore();

            if ( this.options.drawAABB ){
                aabb = body.aabb();
                // draw bounding boxes
                this.drawRect( aabb.x, aabb.y, 2 * aabb.hw, 2 * aabb.hh, this.options.aabbColor );
            }

            if ( this.options.drawRealPosition ){
                // draw the non-interpolated body position
                body._debugView = body._debugView || this.createView(body.geometry, this.options.realBodyStyle);
                ctx.save();
                ctx.translate(pos.x + offset.x, pos.y + offset.y);
                ctx.rotate(body.state.angular.pos);
                ctx.drawImage(body._debugView, -body._debugView.width * 0.5, -body._debugView.height * 0.5);
                ctx.restore();
            }
        }
    };
});
