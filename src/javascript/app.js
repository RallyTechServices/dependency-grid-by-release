Ext.define("TSApp", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    defaults: { margin: 10 },
    items: [
        {xtype:'container',itemId:'selector_box'},
        {xtype:'container',itemId:'display_box'}
    ],

    integrationHeaders : {
        name : "TSApp"
    },
                        
     
    launch: function() {
        var me = this;
        me._addSelector();
    },
      
    _addSelector: function() {
        var me = this;
        var selector_box = this.down('#selector_box');
        selector_box.removeAll();
        selector_box.add({
            xtype:'rallyreleasecombobox',
            fieldLabel: 'Release:',
            width:500,
            margin:10,
            showArrows : false,
            context : this.getContext(),
            growToLongestValue : true,
            defaultToCurrentTimebox : true,
            listeners: {
                scope: me,
                change: function(rcb) {
                    me.release = rcb;
                    me._queryAndDisplayGrid();

                }
            }
        });
    },      

    _queryAndDisplayGrid: function(){
        var me = this;

        var model_name = 'HierarchicalRequirement',
            field_names = ['ObjectID','FormattedID','Name','Project','ScheduleState','Release','Iteration','StartDate','EndDate','ReleaseDate','Successors','Owner','Blocked','BlockedReason','Notes'],
            filters = [];
        var release_name = me.release.rawValue;

        filters = [{property:'Release.Name',value: release_name}];

        me._queryUserStoryAndDependencies(model_name, field_names,filters).then({
            scope: this,
            success: function(store) {
                this._displayGrid(store);
            },
            failure: function(error_message){
                alert(error_message);
            }
        }).always(function() {
            me.setLoading(false);
        });

    },

    _queryUserStoryAndDependencies: function(model_name, field_names, filters){
        var deferred = Ext.create('Deft.Deferred');

        var me = this;

        me._loadAStoreWithAPromise(model_name, field_names, filters).then({
            success: function(records){
                    if (records){
                        var promises = [];
                        Ext.Array.each(records,function(story){
                            promises.push(function(){
                                return me._getCollection(story); 
                            });
                        },me);

                        Deft.Chain.sequence(promises).then({
                            success: function(results){
                                me.logger.log('_after getCollection >',results);

                                var us_deps = [];

                                for (var i = 0; records && i < records.length; i++) {
                                    Ext.Array.each(results[i],function(us){
                                            var us_dep = {
                                                Predecessor: records[i],
                                                Successor: us
                                            }     
                                            us_deps.push(us_dep);
                                    })
                                }
                                // create custom store 
                                var store = Ext.create('Rally.data.custom.Store', {
                                    data: us_deps,
                                    scope: me
                                });
                                deferred.resolve(store);                        
                            },
                            scope: me
                        });
                    } else {
                        deferred.reject('Problem loading: ');
                    }
                },
                failure: function(error_message){

                    deferred.reject(error_message);

                },
                scope: me
            }).always(function() {
                me.setLoading(false);
            });
            return deferred.promise;

    },

    _getCollection: function(record){
        me = this;
        var deferred = Ext.create('Deft.Deferred');
        if(record.get('Successors').Count > 0){
            record.getCollection('Successors').load({
                fetch: ['ObjectID','FormattedID','Name','Project','ScheduleState','Release','Iteration','StartDate','EndDate','ReleaseDate', 'Successors','Owner','Blocked','BlockedReason','Notes'],
                scope: me,
                callback: function(records, operation, success) {
                    deferred.resolve(records);
                     // record.set('__successors',records);
                     // deferred.resolve(story);                    
                }
            });
        }else{
            // record.set('__successors',[]);
            // deferred.resolve(story);    
            deferred.resolve([]);                    

        }
        return deferred;
    },

    _loadAStoreWithAPromise: function(model_name, model_fields, model_filters){
        var deferred = Ext.create('Deft.Deferred');
        var me = this;
        this.logger.log("Starting load:",model_name,model_fields);
          
        Ext.create('Rally.data.wsapi.Store', {
            model: model_name,
            fetch: model_fields,
            filters: model_filters
        }).load({
            callback : function(records, operation, successful) {
                if (successful){
                    deferred.resolve(records);
                } else {
                    me.logger.log("Failed: ", operation);
                    deferred.reject('Problem loading: ' + operation.error.errors.join('. '));
                }
            }
        });
        return deferred.promise;
    },
    
    _displayGrid: function(store){
        this.down('#display_box').removeAll();

         this.down('#selector_box').add({
            xtype:'rallybutton',
            itemId:'export_button',
            text: 'Download CSV',
            margin:10,

            disabled: false,
            iconAlign: 'right',
            listeners: {
                scope: this,
                click: function() {
                    this._export();
                }
            },
            margin: '10',
            scope: this
        });

        var grid = {
            xtype: 'rallygrid',
            store: store,
            showRowActionsColumn: false,
            columnCfgs:[
                {
                    text: 'Give User Story ID', 
                    dataIndex: 'Predecessor',
                    //flex: 1,
                    renderer:function(Predecessor){
                        return Predecessor.get('FormattedID');
                    }
                },
                {
                    text: 'User Story Name', 
                    dataIndex: 'Predecessor',
                    //flex: 2,
                    renderer:function(Predecessor){
                        return Predecessor.get('Name');
                    }
                },
                {
                    text: 'Project Name', 
                    dataIndex: 'Predecessor',
                    //flex: 2,
                    renderer:function(Predecessor){
                        return Predecessor.get('Project') ? Predecessor.get('Project').Name:'';
                    }
                },
                {
                    text: 'Release Name', 
                    dataIndex: 'Predecessor',
                    //flex: 2,
                    renderer:function(Predecessor){
                        return Predecessor.get('Release').Name;
                    }
                },
                {
                    text: 'Release Start Date', 
                    dataIndex: 'Predecessor',
                    //flex: 1,                    
                    renderer:function(Predecessor){
                        return Predecessor.get('Release') ? Predecessor.get('Release').ReleaseStartDate:'';
                    }
                },
                {
                    text: 'Release End Date', 
                    dataIndex: 'Predecessor',
                    //flex: 1,                    
                    renderer:function(Predecessor){
                        return Predecessor.get('Release') ? Predecessor.get('Release').ReleaseDate:'';
                    }
                },
                {
                    text: 'Iteration Name', 
                    dataIndex: 'Predecessor',
                    //flex: 2,                    
                    renderer:function(Predecessor){
                        return Predecessor.get('Iteration') ? Predecessor.get('Iteration').Name:'';
                    }
                },
                {
                    text: 'Iteration Start Date', 
                    dataIndex: 'Predecessor',
                    //flex: 1,                    
                    renderer:function(Predecessor){
                        return Predecessor.get('Iteration') ? Predecessor.get('Iteration').StartDate: '';
                    }
                },
                {
                    text: 'Iteration End Date', 
                    dataIndex: 'Predecessor',
                    //flex: 1,                    
                    renderer:function(Predecessor){
                        return Predecessor.get('Iteration') ? Predecessor.get('Iteration').EndDate : '';
                    }
                },
                {
                    text: 'Schedule State', 
                    dataIndex: 'Predecessor',
                    //flex: 1,                    
                    renderer:function(Predecessor){
                        return Predecessor.get('ScheduleState');
                    }
                },
                {
                    text: 'Owner', 
                    dataIndex: 'Predecessor',
                    //flex: 1,                    
                    renderer:function(Predecessor){
                        return Predecessor.get('Owner') ? Predecessor.get('Owner').Name : '';
                    }
                },
                {
                    text: 'Blocked', 
                    dataIndex: 'Predecessor',
                    //flex: 1,                    
                    renderer:function(Predecessor){
                        return Predecessor.get('Blocked');
                    }
                },
                {
                    text: 'Blocked Reason', 
                    dataIndex: 'Predecessor',
                    //flex: 1,                    
                    renderer:function(Predecessor){
                        return Predecessor.get('BlockedReason');
                    }
                },
                {
                    text: 'Notes', 
                    dataIndex: 'Predecessor',
                    //flex: 2,                    
                    renderer:function(Predecessor){
                        return Predecessor.get('Notes');
                    }
                },
                {
                    text: 'Get User ID', 
                    dataIndex: 'Successor',
                    //flex: 1,
                    renderer:function(Successor){
                        return Successor.get('FormattedID');
                    }
                },
                {
                    text: 'User Story Name', 
                    dataIndex: 'Successor',
                    //flex: 2,
                    renderer:function(Successor){
                        return Successor.get('Name');
                    }
                },
                {
                    text: 'Project Name', 
                    dataIndex: 'Successor',
                    //flex: 2,
                    renderer:function(Successor){
                        return Successor.get('Project') ? Successor.get('Project').Name : '';
                    }
                },
                {
                    text: 'Release Name', 
                    dataIndex: 'Successor',
                    //flex: 2,
                    renderer:function(Successor){
                        return Successor.get('Release') ? Successor.get('Release').Name : '';
                    }
                },
                {
                    text: 'Release Start Date', 
                    dataIndex: 'Successor',
                    //flex: 1,                    
                    renderer:function(Successor){
                        return Successor.get('Release') ? Successor.get('Release').ReleaseStartDate : '';
                    }
                },
                {
                    text: 'Release End Date', 
                    dataIndex: 'Successor',
                    //flex: 1,                    
                    renderer:function(Successor){
                        return Successor.get('Release') ?  Successor.get('Release').ReleaseDate : '';
                    }
                },
                {
                    text: 'Iteration Name', 
                    dataIndex: 'Successor',
                    //flex: 2,                    
                    renderer:function(Successor){
                        return Successor.get('Iteration') ? Successor.get('Iteration').Name : '';
                    }
                },
                {
                    text: 'Iteration Start Date', 
                    dataIndex: 'Successor',
                    //flex: 1,                    
                    renderer:function(Successor){
                        return Successor.get('Iteration') ? Successor.get('Iteration').StartDate : '';
                    }
                },
                {
                    text: 'Iteration End Date', 
                    dataIndex: 'Successor',
                    //flex: 1,                    
                    renderer:function(Successor){
                        return Successor.get('Iteration') ? Successor.get('Iteration').EndDate : '';
                    }
                },
                {
                    text: 'Schedule State', 
                    dataIndex: 'Successor',
                    //flex: 1,                    
                    renderer:function(Successor){
                        return Successor.get('ScheduleState');
                    }
                },
                {
                    text: 'Owner', 
                    dataIndex: 'Successor',
                    //flex: 1,                    
                    renderer:function(Successor){
                        return Successor.get('Owner') ? Successor.get('Owner').Name : ''
                    }
                },
                {
                    text: 'Blocked', 
                    dataIndex: 'Successor',
                    //flex: 1,                    
                    renderer:function(Successor){
                        return Successor.get('Blocked');
                    }
                },
                {
                    text: 'Blocked Reason', 
                    dataIndex: 'Successor',
                    //flex: 1,                    
                    renderer:function(Successor){
                        return Successor.get('BlockedReason');
                    }
                },
                {
                    text: 'Notes', 
                    dataIndex: 'Successor',
                    //flex: 2,                    
                    renderer:function(Successor){
                        return Successor.get('Notes');
                    }
                }]
        };

        this.down('#display_box').add(grid);

    },

    _export: function(){
        var grid = this.down('rallygrid');
        var me = this;

        if ( !grid ) { return; }
        
        this.logger.log('_export',grid);

        var filename = Ext.String.format('dependency-snapsot.csv');

        this.setLoading("Generating CSV");
        Deft.Chain.sequence([
            function() { return Rally.technicalservices.FileUtilities._getCSVFromCustomBackedGrid(grid) } 
        ]).then({
            scope: this,
            success: function(csv){
                if (csv && csv.length > 0){
                    Rally.technicalservices.FileUtilities.saveCSVToFile(csv,filename);
                } else {
                    Rally.ui.notify.Notifier.showWarning({message: 'No data to export'});
                }
                
            }
        }).always(function() { me.setLoading(false); });
    },
    
    getOptions: function() {
        return [
            {
                text: 'About...',
                handler: this._launchInfo,
                scope: this
            }
        ];
    },
    
    _launchInfo: function() {
        if ( this.about_dialog ) { this.about_dialog.destroy(); }
        this.about_dialog = Ext.create('Rally.technicalservices.InfoLink',{});
    },
    
    isExternal: function(){
        return typeof(this.getAppId()) == 'undefined';
    }
    
});
