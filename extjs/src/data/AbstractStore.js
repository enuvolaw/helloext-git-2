/*

This file is part of Ext JS 4

Copyright (c) 2011 Sencha Inc

Contact:  http://www.sencha.com/contact

GNU General Public License Usage
This file may be used under the terms of the GNU General Public License version 3.0 as published by the Free Software Foundation and appearing in the file LICENSE included in the packaging of this file.  Please review the following information to ensure the GNU General Public License version 3.0 requirements will be met: http://www.gnu.org/copyleft/gpl.html.

If you are unsure which license is appropriate for your use, please contact the sales department at http://www.sencha.com/contact.

*/
/**
 * @author Ed Spencer
 * @class Ext.data.AbstractStore
 *
 * <p>AbstractStore is a superclass of {@link Ext.data.Store} and {@link Ext.data.TreeStore}. It's never used directly,
 * but offers a set of methods used by both of those subclasses.</p>
 * 
 * <p>We've left it here in the docs for reference purposes, but unless you need to make a whole new type of Store, what
 * you're probably looking for is {@link Ext.data.Store}. If you're still interested, here's a brief description of what 
 * AbstractStore is and is not.</p>
 * 
 * <p>AbstractStore provides the basic configuration for anything that can be considered a Store. It expects to be 
 * given a {@link Ext.data.Model Model} that represents the type of data in the Store. It also expects to be given a 
 * {@link Ext.data.proxy.Proxy Proxy} that handles the loading of data into the Store.</p>
 * 
 * <p>AbstractStore provides a few helpful methods such as {@link #load} and {@link #sync}, which load and save data
 * respectively, passing the requests through the configured {@link #proxy}. Both built-in Store subclasses add extra
 * behavior to each of these functions. Note also that each AbstractStore subclass has its own way of storing data - 
 * in {@link Ext.data.Store} the data is saved as a flat {@link Ext.util.MixedCollection MixedCollection}, whereas in
 * {@link Ext.data.TreeStore TreeStore} we use a {@link Ext.data.Tree} to maintain the data's hierarchy.</p>
 * 
 * The store provides filtering and sorting support. This sorting/filtering can happen on the client side
 * or can be completed on the server. This is controlled by the {@link #remoteSort} and (@link #remoteFilter{ config
 * options. For more information see the {@link #sort} and {@link #filter} methods.
 */
Ext.define('Ext.data.AbstractStore', {
    requires: ['Ext.util.MixedCollection', 'Ext.data.Operation', 'Ext.util.Filter'],
    
    mixins: {
        observable: 'Ext.util.Observable',
        sortable: 'Ext.util.Sortable'
    },
    
    statics: {
        create: function(store){
            if (!store.isStore) {
                if (!store.type) {
                    store.type = 'store';
                }
                store = Ext.createByAlias('store.' + store.type, store);
            }
            return store;
        }    
    },
    
    remoteSort  : false,
    remoteFilter: false,

    /**
     * @cfg {String/Ext.data.proxy.Proxy/Object} proxy The Proxy to use for this Store. This can be either a string, a config
     * object or a Proxy instance - see {@link #setProxy} for details.
     */

    /**
     * @cfg {Boolean/Object} autoLoad If data is not specified, and if autoLoad is true or an Object, this store's load method
     * is automatically called after creation. If the value of autoLoad is an Object, this Object will be passed to the store's
     * load method. Defaults to false.
     */
    autoLoad: false,

    /**
     * @cfg {Boolean} autoSync True to automatically sync the Store with its Proxy after every edit to one of its Records.
     * Defaults to false.
     */
    autoSync: false,

    /**
     * Sets the updating behavior based on batch synchronization. 'operation' (the default) will update the Store's
     * internal representation of the data after each operation of the batch has completed, 'complete' will wait until
     * the entire batch has been completed before updating the Store's data. 'complete' is a good choice for local
     * storage proxies, 'operation' is better for remote proxies, where there is a comparatively high latency.
     * @property batchUpdateMode
     * @type String
     */
    batchUpdateMode: 'operation',

    /**
     * If true, any filters attached to this Store will be run after loading data, before the datachanged event is fired.
     * Defaults to true, ignored if {@link #remoteFilter} is true
     * @property filterOnLoad
     * @type Boolean
     */
    filterOnLoad: true,

    /**
     * If true, any sorters attached to this Store will be run after loading data, before the datachanged event is fired.
     * Defaults to true, igored if {@link #remoteSort} is true
     * @property sortOnLoad
     * @type Boolean
     */
    sortOnLoad: true,

    /**
     * True if a model was created implicitly for this Store. This happens if a fields array is passed to the Store's constructor
     * instead of a model constructor or name.
     * @property implicitModel
     * @type Boolean
     * @private
     */
    implicitModel: false,

    /**
     * The string type of the Proxy to create if none is specified. This defaults to creating a {@link Ext.data.proxy.Memory memory proxy}.
     * @property defaultProxyType
     * @type String
     */
    defaultProxyType: 'memory',

    /**
     * True if the Store has already been destroyed via {@link #destroyStore}. If this is true, the reference to Store should be deleted
     * as it will not function correctly any more.
     * @property isDestroyed
     * @type Boolean
     */
    isDestroyed: false,

    isStore: true,

    /**
     * @cfg {String} storeId Optional unique identifier for this store. If present, this Store will be registered with 
     * the {@link Ext.data.StoreManager}, making it easy to reuse elsewhere. Defaults to undefined.
     */
    
    /**
     * @cfg {Array} fields
     * This may be used in place of specifying a {@link #model} configuration. The fields should be a 
     * set of {@link Ext.data.Field} configuration objects. The store will automatically create a {@link Ext.data.Model}
     * with these fields. In general this configuration option should be avoided, it exists for the purposes of
     * backwards compatibility. For anything more complicated, such as specifying a particular id property or
     * assocations, a {@link Ext.data.Model} should be defined and specified for the {@link #model} config.
     */

    sortRoot: 'data',
    
    //documented above
    constructor: function(config) {
        var me = this,
            filters;
        
        me.addEvents(
            /**
             * @event add
             * Fired when a Model instance has been added to this Store
             * @param {Ext.data.Store} store The store
             * @param {Array} records The Model instances that were added
             * @param {Number} index The index at which the instances were inserted
             */
            'add',

            /**
             * @event remove
             * Fired when a Model instance has been removed from this Store
             * @param {Ext.data.Store} store The Store object
             * @param {Ext.data.Model} record The record that was removed
             * @param {Number} index The index of the record that was removed
             */
            'remove',
            
            /**
             * @event update
             * Fires when a Record has been updated
             * @param {Store} this
             * @param {Ext.data.Model} record The Model instance that was updated
             * @param {String} operation The update operation being performed. Value may be one of:
             * <pre><code>
               Ext.data.Model.EDIT
               Ext.data.Model.REJECT
               Ext.data.Model.COMMIT
             * </code></pre>
             */
            'update',

            /**
             * @event datachanged
             * Fires whenever the records in the Store have changed in some way - this could include adding or removing records,
             * or updating the data in existing records
             * @param {Ext.data.Store} this The data store
             */
            'datachanged',

            /**
             * @event beforeload
             * Event description
             * @param {Ext.data.Store} store This Store
             * @param {Ext.data.Operation} operation The Ext.data.Operation object that will be passed to the Proxy to load the Store
             */
            'beforeload',

            /**
             * @event load
             * Fires whenever the store reads data from a remote data source.
             * @param {Ext.data.Store} this
             * @param {Array} records An array of records
             * @param {Boolean} successful True if the operation was successful.
             */
            'load',

            /**
             * @event beforesync
             * Called before a call to {@link #sync} is executed. Return false from any listener to cancel the synv
             * @param {Object} options Hash of all records to be synchronized, broken down into create, update and destroy
             */
            'beforesync',
            /**
             * @event clear
             * Fired after the {@link #removeAll} method is called.
             * @param {Ext.data.Store} this
             */
            'clear'
        );
        
        Ext.apply(me, config);
        // don't use *config* anymore from here on... use *me* instead...

        /**
         * Temporary cache in which removed model instances are kept until successfully synchronised with a Proxy,
         * at which point this is cleared.
         * @private
         * @property removed
         * @type Array
         */
        me.removed = [];

        me.mixins.observable.constructor.apply(me, arguments);
        me.model = Ext.ModelManager.getModel(me.model);

        /**
         * @property modelDefaults
         * @type Object
         * @private
         * A set of default values to be applied to every model instance added via {@link #insert} or created via {@link #create}.
         * This is used internally by associations to set foreign keys and other fields. See the Association classes source code
         * for examples. This should not need to be used by application developers.
         */
        Ext.applyIf(me, {
            modelDefaults: {}
        });

        //Supports the 3.x style of simply passing an array of fields to the store, implicitly creating a model
        if (!me.model && me.fields) {
            me.model = Ext.define('Ext.data.Store.ImplicitModel-' + (me.storeId || Ext.id()), {
                extend: 'Ext.data.Model',
                fields: me.fields,
                proxy: me.proxy || me.defaultProxyType
            });

            delete me.fields;

            me.implicitModel = true;
        }

        //ensures that the Proxy is instantiated correctly
        me.setProxy(me.proxy || me.model.getProxy());

        if (me.id && !me.storeId) {
            me.storeId = me.id;
            delete me.id;
        }

        if (me.storeId) {
            Ext.data.StoreManager.register(me);
        }
        
        me.mixins.sortable.initSortable.call(me);        
        
        /**
         * The collection of {@link Ext.util.Filter Filters} currently applied to this Store
         * @property filters
         * @type Ext.util.MixedCollection
         */
        filters = me.decodeFilters(me.filters);
        me.filters = Ext.create('Ext.util.MixedCollection');
        me.filters.addAll(filters);
    },

    /**
     * Sets the Store's Proxy by string, config object or Proxy instance
     * @param {String|Object|Ext.data.proxy.Proxy} proxy The new Proxy, which can be either a type string, a configuration object
     * or an Ext.data.proxy.Proxy instance
     * @return {Ext.data.proxy.Proxy} The attached Proxy object
     */
    setProxy: function(proxy) {
        var me = this;
        
        if (proxy instanceof Ext.data.proxy.Proxy) {
            proxy.setModel(me.model);
        } else {
            if (Ext.isString(proxy)) {
                proxy = {
                    type: proxy    
                };
            }
            Ext.applyIf(proxy, {
                model: me.model
            });
            
            proxy = Ext.createByAlias('proxy.' + proxy.type, proxy);
        }
        
        me.proxy = proxy;
        
        return me.proxy;
    },

    /**
     * Returns the proxy currently attached to this proxy instance
     * @return {Ext.data.proxy.Proxy} The Proxy instance
     */
    getProxy: function() {
        return this.proxy;
    },

    //saves any phantom records
    create: function(data, options) {
        var me = this,
            instance = Ext.ModelManager.create(Ext.applyIf(data, me.modelDefaults), me.model.modelName),
            operation;
        
        options = options || {};

        Ext.applyIf(options, {
            action : 'create',
            records: [instance]
        });

        operation = Ext.create('Ext.data.Operation', options);

        me.proxy.create(operation, me.onProxyWrite, me);
        
        return instance;
    },

    read: function() {
        return this.load.apply(this, arguments);
    },

    onProxyRead: Ext.emptyFn,

    update: function(options) {
        var me = this,
            operation;
        options = options || {};

        Ext.applyIf(options, {
            action : 'update',
            records: me.getUpdatedRecords()
        });

        operation = Ext.create('Ext.data.Operation', options);

        return me.proxy.update(operation, me.onProxyWrite, me);
    },

    /**
     * @private
     * Callback for any write Operation over the Proxy. Updates the Store's MixedCollection to reflect
     * the updates provided by the Proxy
     */
    onProxyWrite: function(operation) {
        var me = this,
            success = operation.wasSuccessful(),
            records = operation.getRecords();

        switch (operation.action) {
            case 'create':
                me.onCreateRecords(records, operation, success);
                break;
            case 'update':
                me.onUpdateRecords(records, operation, success);
                break;
            case 'destroy':
                me.onDestroyRecords(records, operation, success);
                break;
        }

        if (success) {
            me.fireEvent('write', me, operation);
            me.fireEvent('datachanged', me);
        }
        //this is a callback that would have been passed to the 'create', 'update' or 'destroy' function and is optional
        Ext.callback(operation.callback, operation.scope || me, [records, operation, success]);
    },


    //tells the attached proxy to destroy the given records
    destroy: function(options) {
        var me = this,
            operation;
            
        options = options || {};

        Ext.applyIf(options, {
            action : 'destroy',
            records: me.getRemovedRecords()
        });

        operation = Ext.create('Ext.data.Operation', options);

        return me.proxy.destroy(operation, me.onProxyWrite, me);
    },

    /**
     * @private
     * Attached as the 'operationcomplete' event listener to a proxy's Batch object. By default just calls through
     * to onProxyWrite.
     */
    onBatchOperationComplete: function(batch, operation) {
        return this.onProxyWrite(operation);
    },

    /**
     * @private
     * Attached as the 'complete' event listener to a proxy's Batch object. Iterates over the batch operations
     * and updates the Store's internal data MixedCollection.
     */
    onBatchComplete: function(batch, operation) {
        var me = this,
            operations = batch.operations,
            length = operations.length,
            i;

        me.suspendEvents();

        for (i = 0; i < length; i++) {
            me.onProxyWrite(operations[i]);
        }

        me.resumeEvents();

        me.fireEvent('datachanged', me);
    },

    onBatchException: function(batch, operation) {
        // //decide what to do... could continue with the next operation
        // batch.start();
        //
        // //or retry the last operation
        // batch.retry();
    },

    /**
     * @private
     * Filter function for new records.
     */
    filterNew: function(item) {
        // only want phantom records that are valid
        return item.phantom === true && item.isValid();
    },

    /**
     * Returns all Model instances that are either currently a phantom (e.g. have no id), or have an ID but have not
     * yet been saved on this Store (this happens when adding a non-phantom record from another Store into this one)
     * @return {Array} The Model instances
     */
    getNewRecords: function() {
        return [];
    },

    /**
     * Returns all Model instances that have been updated in the Store but not yet synchronized with the Proxy
     * @return {Array} The updated Model instances
     */
    getUpdatedRecords: function() {
        return [];
    },

    /**
     * @private
     * Filter function for updated records.
     */
    filterUpdated: function(item) {
        // only want dirty records, not phantoms that are valid
        return item.dirty === true && item.phantom !== true && item.isValid();
    },

    /**
     * Returns any records that have been removed from the store but not yet destroyed on the proxy.
     * @return {Array} The removed Model instances
     */
    getRemovedRecords: function() {
        return this.removed;
    },

    filter: function(filters, value) {

    },

    /**
     * @private
     * Normalizes an array of filter objects, ensuring that they are all Ext.util.Filter instances
     * @param {Array} filters The filters array
     * @return {Array} Array of Ext.util.Filter objects
     */
    decodeFilters: function(filters) {
        if (!Ext.isArray(filters)) {
            if (filters === undefined) {
                filters = [];
            } else {
                filters = [filters];
            }
        }

        var length = filters.length,
            Filter = Ext.util.Filter,
            config, i;

        for (i = 0; i < length; i++) {
            config = filters[i];

            if (!(config instanceof Filter)) {
                Ext.apply(config, {
                    root: 'data'
                });

                //support for 3.x style filters where a function can be defined as 'fn'
                if (config.fn) {
                    config.filterFn = config.fn;
                }

                //support a function to be passed as a filter definition
                if (typeof config == 'function') {
                    config = {
                        filterFn: config
                    };
                }

                filters[i] = new Filter(config);
            }
        }

        return filters;
    },

    clearFilter: function(supressEvent) {

    },

    isFiltered: function() {

    },

    filterBy: function(fn, scope) {

    },
    
    /**
     * Synchronizes the Store with its Proxy. This asks the Proxy to batch together any new, updated
     * and deleted records in the store, updating the Store's internal representation of the records
     * as each operation completes.
     */
    sync: function() {
        var me        = this,
            options   = {},
            toCreate  = me.getNewRecords(),
            toUpdate  = me.getUpdatedRecords(),
            toDestroy = me.getRemovedRecords(),
            needsSync = false;

        if (toCreate.length > 0) {
            options.create = toCreate;
            needsSync = true;
        }

        if (toUpdate.length > 0) {
            options.update = toUpdate;
            needsSync = true;
        }

        if (toDestroy.length > 0) {
            options.destroy = toDestroy;
            needsSync = true;
        }

        if (needsSync && me.fireEvent('beforesync', options) !== false) {
            me.proxy.batch(options, me.getBatchListeners());
        }
    },


    /**
     * @private
     * Returns an object which is passed in as the listeners argument to proxy.batch inside this.sync.
     * This is broken out into a separate function to allow for customisation of the listeners
     * @return {Object} The listeners object
     */
    getBatchListeners: function() {
        var me = this,
            listeners = {
                scope: me,
                exception: me.onBatchException
            };

        if (me.batchUpdateMode == 'operation') {
            listeners.operationcomplete = me.onBatchOperationComplete;
        } else {
            listeners.complete = me.onBatchComplete;
        }

        return listeners;
    },

    //deprecated, will be removed in 5.0
    save: function() {
        return this.sync.apply(this, arguments);
    },

    /**
     * Loads the Store using its configured {@link #proxy}.
     * @param {Object} options Optional config object. This is passed into the {@link Ext.data.Operation Operation}
     * object that is created and then sent to the proxy's {@link Ext.data.proxy.Proxy#read} function
     */
    load: function(options) {
        var me = this,
            operation;

        options = options || {};

        Ext.applyIf(options, {
            action : 'read',
            filters: me.filters.items,
            sorters: me.getSorters()
        });
        
        operation = Ext.create('Ext.data.Operation', options);

        if (me.fireEvent('beforeload', me, operation) !== false) {
            me.loading = true;
            me.proxy.read(operation, me.onProxyLoad, me);
        }
        
        return me;
    },

    /**
     * @private
     * A model instance should call this method on the Store it has been {@link Ext.data.Model#join joined} to.
     * @param {Ext.data.Model} record The model instance that was edited
     */
    afterEdit : function(record) {
        var me = this;
        
        if (me.autoSync) {
            me.sync();
        }
        
        me.fireEvent('update', me, record, Ext.data.Model.EDIT);
    },

    /**
     * @private
     * A model instance should call this method on the Store it has been {@link Ext.data.Model#join joined} to..
     * @param {Ext.data.Model} record The model instance that was edited
     */
    afterReject : function(record) {
        this.fireEvent('update', this, record, Ext.data.Model.REJECT);
    },

    /**
     * @private
     * A model instance should call this method on the Store it has been {@link Ext.data.Model#join joined} to.
     * @param {Ext.data.Model} record The model instance that was edited
     */
    afterCommit : function(record) {
        this.fireEvent('update', this, record, Ext.data.Model.COMMIT);
    },

    clearData: Ext.emptyFn,

    destroyStore: function() {
        var me = this;
        
        if (!me.isDestroyed) {
            if (me.storeId) {
                Ext.data.StoreManager.unregister(me);
            }
            me.clearData();
            me.data = null;
            me.tree = null;
            // Ext.destroy(this.proxy);
            me.reader = me.writer = null;
            me.clearListeners();
            me.isDestroyed = true;

            if (me.implicitModel) {
                Ext.destroy(me.model);
            }
        }
    },
    
    doSort: function(sorterFn) {
        var me = this;
        if (me.remoteSort) {
            //the load function will pick up the new sorters and request the sorted data from the proxy
            me.load();
        } else {
            me.data.sortBy(sorterFn);
            me.fireEvent('datachanged', me);
        }
    },

    getCount: Ext.emptyFn,

    getById: Ext.emptyFn,
    
    /**
     * Removes all records from the store. This method does a "fast remove",
     * individual remove events are not called. The {@link #clear} event is
     * fired upon completion.
     * @method
     */
    removeAll: Ext.emptyFn,
    // individual substores should implement a "fast" remove
    // and fire a clear event afterwards

    /**
     * Returns true if the Store is currently performing a load operation
     * @return {Boolean} True if the Store is currently loading
     */
    isLoading: function() {
        return this.loading;
     }
});

