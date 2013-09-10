Ext.require('Ext.container.Viewport');

Ext.application({
    name: 'HelloExt',
    launch: function() {
        Ext.create('Ext.panel.Panel', {
            layout: 'fit',
            title: 'Hello Ext',
            html : 'Hello! Welcome to Ext JS.',
            buttons:[{
            	text: 'Button 1',
				handler: function() {
							alert('You clicked the button 1');
				}
            }],
            renderTo: Ext.getBody(),
        });
    }
});