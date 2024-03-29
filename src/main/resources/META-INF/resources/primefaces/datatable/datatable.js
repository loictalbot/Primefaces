/**
 * PrimeFaces DataTable Widget
 */
PrimeFaces.widget.DataTable = PrimeFaces.widget.DeferredWidget.extend({
    
    init: function(cfg) {
        this._super(cfg);
        
        this.thead = $(this.jqId + '_head'); 
        this.tbody = $(this.jqId + '_data');

        if(this.cfg.paginator) {
            this.bindPaginator();
        }

        this.bindSortEvents();

        if(this.cfg.selectionMode) {
            this.selectionHolder = this.jqId + '_selection';

            var preselection = $(this.selectionHolder).val();
            this.selection = preselection == "" ? [] : preselection.split(',');
            
            //shift key based range selection
            this.originRowIndex = 0;
            this.cursorIndex = null;

            this.bindSelectionEvents();
        }

        if(this.cfg.filter) {
            this.setupFiltering();
        }

        if(this.cfg.expansion) {
            this.expansionProcess = [];
            this.bindExpansionEvents();
        }

        if(this.cfg.editable) {
            this.bindEditEvents();
        }
        
        this.renderDeferred();
    },
    
    _render: function() {
        if(this.cfg.scrollable) {
            this.setupScrolling();
        }

        if(this.cfg.resizableColumns) {
            this.setupResizableColumns();
        }

        if(this.cfg.draggableColumns) {
            this.setupDraggableColumns();
        }

        if(this.cfg.stickyHeader) {
            this.setupStickyHeader();
        }
    },

    /**
     * @Override
     */
    refresh: function(cfg) {
        //remove arrows
        if(cfg.draggableColumns) {
            var jqId = PrimeFaces.escapeClientId(cfg.id);
            $(jqId + '_dnd_top,' + jqId + '_dnd_bottom').remove();
        }
        
        this.columnWidthsFixed = false;
        
        this.init(cfg);
    },
    
    /**
     * Binds the change event listener and renders the paginator
     */
    bindPaginator: function() {
        var _self = this;
        this.cfg.paginator.paginate = function(newState) {
            _self.paginate(newState);
        };

        this.paginator = new PrimeFaces.widget.Paginator(this.cfg.paginator);
    },
    
    /**
     * Applies events related to sorting in a non-obstrusive way
     */
    bindSortEvents: function() {
        var $this = this,
        sortableColumns = this.thead.find('> tr > th.ui-sortable-column');
        
        if(this.cfg.multiSort) {
            this.sortMeta = [];
        }
        
        sortableColumns.filter('.ui-state-active').each(function() {
            var columnHeader = $(this),
            sortIcon = columnHeader.children('span.ui-sortable-column-icon'),
            sortOrder = null;
            
            if(sortIcon.hasClass('ui-icon-triangle-1-n'))
                sortOrder = 'ASCENDING';
            else
                sortOrder = 'DESCENDING';
            
            columnHeader.data('sortorder', sortOrder);
            
            if($this.cfg.multiSort) {
                $this.addSortMeta({
                    col: columnHeader.attr('id'), 
                    order: sortOrder
                });
            }            
        });
        
        sortableColumns.on('mouseover.dataTable', function() {
            var column = $(this);
            
            if(!column.hasClass('ui-state-active'))
                column.addClass('ui-state-hover');
        })
        .on('mouseout.dataTable', function() {
            var column = $(this);
            
            if(!column.hasClass('ui-state-active'))
                column.removeClass('ui-state-hover');
        })
        .on('click.dataTable', function(e) {
            if($(e.target).is(':not(th,span)')) {
                return;
            }

            PrimeFaces.clearSelection();
                
            var columnHeader = $(this),
            sortOrder = columnHeader.data('sortorder')||'DESCENDING',
            metaKey = e.metaKey||e.ctrlKey;
                                
            if(sortOrder === 'ASCENDING')
                sortOrder = 'DESCENDING';
            else if(sortOrder === 'DESCENDING')
                sortOrder = 'ASCENDING';
                
            if($this.cfg.multiSort) {                      
                if(metaKey) {
                    $this.addSortMeta({
                        col: columnHeader.attr('id'), 
                        order: sortOrder
                    });
                    $this.sort(columnHeader, sortOrder, true);
                }
                else {                        
                    $this.sortMeta = [];
                    $this.addSortMeta({
                        col: columnHeader.attr('id'), 
                        order: sortOrder
                    });
                    $this.sort(columnHeader, sortOrder);
                }
            }
            else {
                $this.sort(columnHeader, sortOrder);
            }

        });
    },
    
    addSortMeta: function(meta) {
        this.sortMeta = $.grep(this.sortMeta, function(value) {
            return value.col !== meta.col;
        });
        
        this.sortMeta.push(meta);
    },
      
    /**
     * Binds filter events to filters
     */
    setupFiltering: function() {
        var $this = this;
        this.cfg.filterEvent = this.cfg.filterEvent||'keyup';
        this.cfg.filterDelay = this.cfg.filterDelay||300;

        this.thead.find('> tr > th.ui-filter-column > .ui-column-filter').each(function() {
            var filter = $(this);

            if(filter.is('input:text')) {
                PrimeFaces.skinInput(filter);

                if($this.cfg.filterEvent === 'enter')
                    $this.bindEnterKeyFilter(filter);
                else
                    $this.bindFilterEvent(filter);
            } 
            else {
                PrimeFaces.skinSelect(filter);
                
                filter.change(function(e) {
                    $this.filter();
                });
            }
        });
    },
    
    bindEnterKeyFilter: function(filter) {
        var $this = this;
    
        filter.bind('keydown', function(e) {
            var key = e.which,
            keyCode = $.ui.keyCode;

            if((key === keyCode.ENTER||key === keyCode.NUMPAD_ENTER)) {
                e.preventDefault();
            }
        }).bind('keyup', function(e) {
            var key = e.which,
            keyCode = $.ui.keyCode;

            if((key === keyCode.ENTER||key === keyCode.NUMPAD_ENTER)) {
                $this.filter();

                e.preventDefault();
            }
        });
    },
    
    bindFilterEvent: function(filter) {
        var $this = this;
    
        filter.bind(this.cfg.filterEvent, function(e) {
            if($this.filterTimeout) {
                clearTimeout($this.filterTimeout);
            }

            $this.filterTimeout = setTimeout(function() {
                $this.filter();
                $this.filterTimeout = null;
            }, 
            $this.cfg.filterDelay);
        });
    },
    
    /**
     * Applies events related to selection in a non-obstrusive way
     */
    bindSelectionEvents: function() {
        var $this = this;
        this.rowSelector = this.jqId + ' tbody.ui-datatable-data > tr.ui-widget-content:not(.ui-datatable-empty-message)';

        //row events
        if(this.cfg.selectionMode != 'radio') {
            this.bindRowHover();
            
            $(document).off('click.datatable', this.rowSelector).on('click.datatable', this.rowSelector, null, function(e) {
                $this.onRowClick(e, this);
            });
        }
        else {
            this.bindRadioEvents();
        }
        
        if(this.isCheckboxSelectionEnabled()) {
            this.bindCheckboxEvents();
            this.updateHeaderCheckbox();
        }
        
        //double click
        if(this.hasBehavior('rowDblselect')) {
            $(document).off('dblclick.datatable', this.rowSelector).on('dblclick.datatable', this.rowSelector, null, function(e) {
                $this.onRowDblclick(e, $(this));
            });
        };
    },
    
    bindRowHover: function() {
        $(document).off('mouseover.datatable mouseout.datatable', this.rowSelector)
                    .on('mouseover.datatable', this.rowSelector, null, function() {
                        var element = $(this);

                        if(!element.hasClass('ui-state-highlight')) {
                            element.addClass('ui-state-hover');
                        }
                    })
                    .on('mouseout.datatable', this.rowSelector, null, function() {
                        var element = $(this);

                        if(!element.hasClass('ui-state-highlight')) {
                            element.removeClass('ui-state-hover');
                        }
                    });
    },
    
    bindRadioEvents: function() {
        var radioSelector = this.jqId + ' tbody.ui-datatable-data > tr.ui-widget-content:not(.ui-datatable-empty-message) > td.ui-selection-column .ui-radiobutton .ui-radiobutton-box',
        radioInputSelector = this.jqId + ' tbody.ui-datatable-data > tr.ui-widget-content:not(.ui-datatable-empty-message) > td.ui-selection-column .ui-radiobutton input',
        _self = this;
                
        $(document).off('click.ui-radiobutton mouseover.ui-radiobutton mouseout.ui-radiobutton', radioSelector)
        .on('mouseover.ui-radiobutton', radioSelector, null, function() {
            var radio = $(this);
            if(!radio.hasClass('ui-state-disabled')&&!radio.hasClass('ui-state-active')) {
                radio.addClass('ui-state-hover');
            }
        })
        .on('mouseout.ui-radiobutton', radioSelector, null, function() {
            var radio = $(this);
            radio.removeClass('ui-state-hover');
        })
        .on('click.ui-radiobutton', radioSelector, null, function() {
            var radio = $(this),
            checked = radio.hasClass('ui-state-active'),
            disabled = radio.hasClass('ui-state-disabled');

            if(!disabled && !checked) {
                _self.selectRowWithRadio(radio);
            }
        });
    
                       
        //keyboard support
        $(document).off('focus.ui-radiobutton blur.ui-radiobutton change.ui-radiobutton', radioInputSelector)
        .on('focus.ui-radiobutton', radioInputSelector, null, function() {
            var input = $(this),
            box = input.parent().next();

            if(input.prop('checked')) {
                box.removeClass('ui-state-active');
            }

            box.addClass('ui-state-focus');
        })
        .on('blur.ui-radiobutton', radioInputSelector, null, function() {
            var input = $(this),
            box = input.parent().next();

            if(input.prop('checked')) {
                box.addClass('ui-state-active');
            }

            box.removeClass('ui-state-focus');
        })
        .on('change.ui-radiobutton', radioInputSelector, null, function() {
            var currentInput = $(radioInputSelector).filter(':checked'),
            currentRadio = currentInput.parent().next();

            _self.selectRowWithRadio(currentRadio);
        });
                      
    },
    
    bindCheckboxEvents: function() {
        var checkAllTogglerSelector = this.jqId + ' table thead th.ui-selection-column .ui-chkbox.ui-chkbox-all .ui-chkbox-box',
        _self = this;
        
        this.checkAllToggler = $(checkAllTogglerSelector);
        
        //check-uncheck all
        this.checkAllToggler.on('mouseover', function() {
            var box = $(this);
            if(!box.hasClass('ui-state-disabled')&&!box.hasClass('ui-state-active')) {
                box.addClass('ui-state-hover');
            }
        })
        .on('mouseout', function() {
            $(this).removeClass('ui-state-hover');
        })
        .on('click', function() {
            _self.toggleCheckAll();
        });

        //row checkboxes
        var checkboxSelector = this.jqId + ' tbody.ui-datatable-data > tr.ui-widget-content:not(.ui-datatable-empty-message) > td.ui-selection-column .ui-chkbox .ui-chkbox-box',
        checkboxInputSelector = this.jqId + ' tbody.ui-datatable-data > tr.ui-widget-content:not(.ui-datatable-empty-message) > td.ui-selection-column .ui-chkbox input';

        $(document).off('mouseover.ui-chkbox mouseover.ui-chkbox click.ui-chkbox', checkboxSelector)
                    .on('mouseover.ui-chkbox', checkboxSelector, null, function() {
                        var box = $(this);
                        if(!box.hasClass('ui-state-disabled')&&!box.hasClass('ui-state-active')) {
                            box.addClass('ui-state-hover');
                        }
                    })
                    .on('mouseout.ui-chkbox', checkboxSelector, null, function() {
                        $(this).removeClass('ui-state-hover');
                    })
                    .on('click.ui-chkbox', checkboxSelector, null, function() {
                        var checkbox = $(this);

                        if(!checkbox.hasClass('ui-state-disabled')) {
                            var checked = checkbox.hasClass('ui-state-active');

                            if(checked)
                                _self.unselectRowWithCheckbox(checkbox);
                            else                      
                                _self.selectRowWithCheckbox(checkbox);
                        }
                    });

        //keyboard support
        $(document).off('focus.ui-chkbox blur.ui-chkbox keydown.ui-chkbox keyup.ui-chkbox', checkboxInputSelector)
                    .on('focus.ui-chkbox', checkboxInputSelector, null, function() {
                        var input = $(this),
                        box = input.parent().next();

                        if(input.prop('checked')) {
                            box.removeClass('ui-state-active');
                        }

                        box.addClass('ui-state-focus');
                    })
                    .on('blur.ui-chkbox', checkboxInputSelector, null, function() {
                        var input = $(this),
                        box = input.parent().next();

                        if(input.prop('checked')) {
                            box.addClass('ui-state-active');
                        }

                        box.removeClass('ui-state-focus');
                    })
                    .on('keydown.ui-chkbox', checkboxInputSelector, null, function(e) {
                        var keyCode = $.ui.keyCode;
                        if(e.which == keyCode.SPACE) {
                            e.preventDefault();
                        }
                    })
                    .on('keyup.ui-chkbox', checkboxInputSelector, null, function(e) {
                        var keyCode = $.ui.keyCode;

                        if(e.which == keyCode.SPACE) {
                            var input = $(this),
                            box = input.parent().next();

                            if(input.prop('checked')) {
                                _self.unselectRowWithCheckbox(box);
                            } 
                            else {                        
                                _self.selectRowWithCheckbox(box);
                            }

                            e.preventDefault();
                        }
                    });
    },
    
    /**
     * Applies events related to row expansion in a non-obstrusive way
     */
    bindExpansionEvents: function() {
        var $this = this,
        togglerSelector = this.jqId + ' tbody.ui-datatable-data > tr > td > div.ui-row-toggler';

        $(document).off('click.datatable-expansion', togglerSelector)
                    .on('click.datatable-expansion', togglerSelector, null, function() {
                        $this.toggleExpansion($(this));
                    });
    },
    
    setupScrolling: function() {
        this.scrollHeader = this.jq.children('.ui-datatable-scrollable-header');
        this.scrollBody = this.jq.children('.ui-datatable-scrollable-body');
        this.scrollFooter = this.jq.children('.ui-datatable-scrollable-footer')
        this.scrollStateHolder = $(this.jqId + '_scrollState');
        this.scrollHeaderBox = this.scrollHeader.children('div.ui-datatable-scrollable-header-box');
        this.scrollFooterBox = this.scrollFooter.children('div.ui-datatable-scrollable-footer-box');
        this.headerTable = this.scrollHeaderBox.children('table');
        this.bodyTable = this.scrollBody.children('table');
        this.footerTable = this.scrollFooter.children('table');
        this.colgroup = this.scrollBody.find('> table > colgroup');
        this.footerCols = this.scrollFooter.find('> .ui-datatable-scrollable-footer-box > table > tfoot > tr > td');
        this.percentageScrollHeight = this.cfg.scrollHeight && (this.cfg.scrollHeight.indexOf('%') !== -1);
        this.percentageScrollWidth = this.cfg.scrollWidth && (this.cfg.scrollWidth.indexOf('%') !== -1);
        var $this = this,
        scrollBarWidth = this.getScrollbarWidth() + 'px';
        
        if(this.percentageScrollHeight) {
            this.adjustScrollHeight();
        }

        this.scrollHeaderBox.css('margin-right', scrollBarWidth);
        this.scrollFooterBox.css('margin-right', scrollBarWidth);
        
        this.alignScrollBody();
        this.fixColumnWidths();
        
        if(this.cfg.scrollWidth) {
            if(this.percentageScrollWidth)
                this.adjustScrollWidth();
            else
                this.setScrollWidth(this.cfg.scrollWidth);
        }
        
        this.restoreScrollState();

        if(this.cfg.liveScroll) {
            this.scrollOffset = this.cfg.scrollStep;
            this.shouldLiveScroll = true;       
        }
        
        this.scrollBody.scroll(function() {
            var scrollLeft = $this.scrollBody.scrollLeft();
            $this.scrollHeaderBox.css('margin-left', -scrollLeft);
            $this.scrollFooterBox.css('margin-left', -scrollLeft);

            if($this.shouldLiveScroll) {
                var scrollTop = this.scrollTop,
                scrollHeight = this.scrollHeight,
                viewportHeight = this.clientHeight;

                if(scrollTop >= (scrollHeight - (viewportHeight))) {
                    $this.loadLiveRows();
                }
            }
            
            $this.saveScrollState();
        });
        
        var resizeNS = 'resize.' + this.id;
        $(window).unbind(resizeNS).bind(resizeNS, function() {
            if($this.jq.is(':visible')) {
                if($this.percentageScrollHeight)
                    $this.adjustScrollHeight();
                
                if($this.percentageScrollWidth)
                    $this.adjustScrollWidth();
            }
        });
    },
            
    adjustScrollHeight: function() {
        var relativeHeight = this.jq.parent().innerHeight() * (parseInt(this.cfg.scrollHeight) / 100),
        scrollersHeight = (this.scrollHeader.innerHeight() + this.scrollFooter.innerHeight()),
        paginatorsHeight = this.paginator ? this.paginator.getContainerHeight() : 0,
        height = (relativeHeight - (scrollersHeight + paginatorsHeight));
        
        this.scrollBody.height(height);
    },
            
    adjustScrollWidth: function() {
        var width = parseInt((this.jq.parent().innerWidth() * (parseInt(this.cfg.scrollWidth) / 100)));
        this.setScrollWidth(width);
    },
            
    setScrollWidth: function(width) {
        this.scrollHeader.width(width);
        this.scrollBody.css('margin-right', 0).width(width);
        this.scrollFooter.width(width);
    },
    
    getScrollbarWidth: function() {
        if(!this.scrollbarWidth) {
            this.scrollbarWidth = $.browser.webkit ? '15' : PrimeFaces.calculateScrollbarWidth();
        }
        
        return this.scrollbarWidth;
    },
    
    alignScrollBody: function() {
        var verticalScroll = this.bodyTable.outerHeight() > this.scrollBody.outerHeight(),
        marginRight = verticalScroll ? '0px' : this.getScrollbarWidth() + 'px';

        this.scrollBody.css('margin-right', marginRight);
    },
    
    restoreScrollState: function() {
        var scrollState = this.scrollStateHolder.val(),
        scrollValues = scrollState.split(',');

        this.scrollBody.scrollLeft(scrollValues[0]);
        this.scrollBody.scrollTop(scrollValues[1]);
    },
    
    saveScrollState: function() {
        var scrollState = this.scrollBody.scrollLeft() + ',' + this.scrollBody.scrollTop();
        
        this.scrollStateHolder.val(scrollState);
    },
    
    fixColumnWidths: function() {
        var $this = this;
        
        if(!this.columnWidthsFixed) {
            if(this.cfg.scrollable) {
                this.scrollHeader.find('> .ui-datatable-scrollable-header-box > table > thead > tr > th').each(function() {
                    var headerCol = $(this),
                    colIndex = headerCol.index(),
                    width = headerCol.width(),
                    innerWidth = headerCol.innerWidth();
                    
                    headerCol.width(width);
                    $this.colgroup.children().eq(colIndex).width(innerWidth + 1);
                    if($this.footerCols.length > 0) {
                        var footerCol = $this.footerCols.eq(colIndex);
                        footerCol.width(width);
                    }
                });
            }
            else {
                this.jq.find('> .ui-datatable-tablewrapper > table > thead > tr > th').each(function() {
                    var col = $(this);
                    col.width(col.width());
                });
            }
            
            this.columnWidthsFixed = true;
        }
    },
    
    /**
     * Loads rows on-the-fly when scrolling live
     */
    loadLiveRows: function() {
        var options = {
            source: this.id,
            process: this.id,
            update: this.id,
            formId: this.cfg.formId
        },
        _self = this;

        options.onsuccess = function(responseXML) {
            var xmlDoc = $(responseXML.documentElement),
            updates = xmlDoc.find("update");

            for(var i=0; i < updates.length; i++) {
                var update = updates.eq(i),
                id = update.attr('id'),
                content = update.get(0).childNodes[0].nodeValue;

                if(id == _self.id) {
                    var lastRow = $(_self.jqId + ' .ui-datatable-scrollable-body table tr:last');
                    
                    //insert new rows
                    lastRow.after(content);

                    _self.scrollOffset += _self.cfg.scrollStep;

                    //Disable scroll if there is no more data left
                    if(_self.scrollOffset == _self.cfg.scrollLimit) {
                        _self.shouldLiveScroll = false;
                    }
                }
                else {
                    PrimeFaces.ajax.AjaxUtils.updateElement.call(this, id, content);
                }
            }

            PrimeFaces.ajax.AjaxUtils.handleResponse.call(this, xmlDoc);

            return true;
        };

        options.params = [
        {
            name: this.id + '_scrolling', 
            value: true
        },

        {
            name: this.id + '_scrollOffset', 
            value: this.scrollOffset
            },

            {
            name: this.id + '_encodeFeature', 
            value: true
        }
        ];

        PrimeFaces.ajax.AjaxRequest(options);
    },
    
    /**
     * Ajax pagination
     */
    paginate: function(newState) {
        var options = {
            source: this.id,
            update: this.id,
            process: this.id,
            formId: this.cfg.formId
        };

        var $this = this;

        options.onsuccess = function(responseXML) {
            var xmlDoc = $(responseXML.documentElement),
            updates = xmlDoc.find("update");

            for(var i=0; i < updates.length; i++) {
                var update = updates.eq(i),
                id = update.attr('id'),
                content = update.get(0).childNodes[0].nodeValue;

                if(id == $this.id) {
                    $this.tbody.html(content);

                    if($this.checkAllToggler) {
                        $this.updateHeaderCheckbox();
                    }
                    
                    if($this.cfg.scrollable) {
                        $this.alignScrollBody();
                    }
                }
                else {
                    PrimeFaces.ajax.AjaxUtils.updateElement.call(this, id, content);
                }
            }

            PrimeFaces.ajax.AjaxUtils.handleResponse.call(this, xmlDoc);
            
            return true;
        };
        
        options.oncomplete = function() {
            //update paginator state
            $this.paginator.cfg.page = newState.page;
            
            $this.paginator.updateUI();
        };

        options.params = [
        {
            name: this.id + '_pagination', 
            value: true
        },

        {
            name: this.id + '_first', 
            value: newState.first
            },

            {
            name: this.id + '_rows', 
            value: newState.rows
            },

            {
            name: this.id + '_encodeFeature', 
            value: true
        }
        ];

        if(this.hasBehavior('page')) {
            var pageBehavior = this.cfg.behaviors['page'];

            pageBehavior.call(this, newState, options);
        } 
        else {
            PrimeFaces.ajax.AjaxRequest(options); 
        }
    },
    
    /**
     * Ajax sort
     */
    sort: function(columnHeader, order, multi) {  
        columnHeader.data('sortorder', order);
    
        var options = {
            source: this.id,
            update: this.id,
            process: this.id
        },
        $this = this;
        
        options.onsuccess = function(responseXML) {
            var xmlDoc = $(responseXML.documentElement),
            updates = xmlDoc.find("update");

            for(var i=0; i < updates.length; i++) {
                var update = updates.eq(i),
                id = update.attr('id'),
                content = update.get(0).childNodes[0].nodeValue;

                if(id == $this.id) {
                    $this.tbody.html(content);

                    var paginator = $this.getPaginator();
                    if(paginator) {
                        paginator.setPage(0, true);
                    }
                }
                else {
                    PrimeFaces.ajax.AjaxUtils.updateElement.call(this, id, content);
                }
                
                if(!multi) {
                    columnHeader.siblings('.ui-state-active').removeData('sortorder').removeClass('ui-state-active')
                                .find('.ui-sortable-column-icon').removeClass('ui-icon-triangle-1-n ui-icon-triangle-1-s');
                }
                
                columnHeader.removeClass('ui-state-hover').addClass('ui-state-active');
                var sortIcon = columnHeader.find('.ui-sortable-column-icon');

                if(order === 'DESCENDING') {
                    sortIcon.removeClass('ui-icon-triangle-1-n').addClass('ui-icon-triangle-1-s');
                }
                else if(order === 'ASCENDING') {
                    sortIcon.removeClass('ui-icon-triangle-1-s').addClass('ui-icon-triangle-1-n');
                }
            }

            PrimeFaces.ajax.AjaxUtils.handleResponse.call(this, xmlDoc);
            
            var paginator = $this.getPaginator();             
            if(paginator && this.args && paginator.cfg.rowCount !== this.args.totalRecords) {
                paginator.setTotalRecords(this.args.totalRecords);
            }

            return true;
        };
                
        options.params = [{name: this.id + '_sorting', value: true},
                          {name: this.id + '_skipChildren', value: true},
                          {name: this.id + '_encodeFeature', value: true}];

        if(multi) {
            options.params.push({name: this.id + '_multiSorting', value: true});
            options.params.push({name: this.id + '_sortKey', value: $this.joinSortMetaOption('col')});
            options.params.push({name: this.id + '_sortDir', value: $this.joinSortMetaOption('order')});
        }
        else {
            options.params.push({name: this.id + '_sortKey', value: columnHeader.attr('id')});
            options.params.push({name: this.id + '_sortDir', value: order});
        }

        if(this.hasBehavior('sort')) {
            var sortBehavior = this.cfg.behaviors['sort'];

            sortBehavior.call(this, columnHeader, options);
        } 
        else {
            PrimeFaces.ajax.AjaxRequest(options); 
        }
    },
    
    joinSortMetaOption: function(option) {
        var value = '';
        
        for(var i = 0; i < this.sortMeta.length; i++) {
            value += this.sortMeta[i][option];
            
            if(i !== (this.sortMeta.length - 1)) {
                value += ',';
            }
        }
        
        return value;
    },
        
    /**
     * Ajax filter
     */
    filter: function() {
        var options = {
            source: this.id,
            update: this.id,
            process: this.id,
            formId: this.cfg.formId
        };

        var $this = this;

        options.onsuccess = function(responseXML) {
            var xmlDoc = $(responseXML.documentElement),
            updates = xmlDoc.find("update");

            for(var i=0; i < updates.length; i++) {
                var update = updates.eq(i),
                id = update.attr('id'),
                content = update.get(0).childNodes[0].nodeValue;

                if(id == $this.id){
                    $this.tbody.html(content);
                }
                else {
                    PrimeFaces.ajax.AjaxUtils.updateElement.call(this, id, content);
                }
            }

            PrimeFaces.ajax.AjaxUtils.handleResponse.call(this, xmlDoc);
            
            var paginator = $this.getPaginator();
            if(paginator) {
                paginator.setTotalRecords(this.args.totalRecords);
            }

            if($this.cfg.scrollable) {
                $this.alignScrollBody();
            }

            if($this.isCheckboxSelectionEnabled()) {
                $this.updateHeaderCheckbox();
            }
            
            return true;
        };

        options.params = [
                            {name: this.id + '_filtering', value: true},
                            {name: this.id + '_encodeFeature', value: true}
                        ];

        if(this.hasBehavior('filter')) {
            var filterBehavior = this.cfg.behaviors['filter'];

            filterBehavior.call(this, {}, options);
        } 
        else {
            PrimeFaces.ajax.AjaxRequest(options); 
        }
    },
    
    onRowClick: function(event, rowElement, silent) {    
        //Check if rowclick triggered this event not a clickable element in row content
        if($(event.target).is('td,span:not(.ui-c)')) {
            var row = $(rowElement),
            selected = row.hasClass('ui-state-highlight'),
            metaKey = event.metaKey||event.ctrlKey,
            shiftKey = event.shiftKey;

            //unselect a selected row if metakey is on
            if(selected && metaKey) {
                this.unselectRow(row, silent);
            }
            else {
                //unselect previous selection if this is single selection or multiple one with no keys
                if(this.isSingleSelection() || (this.isMultipleSelection() && event && !metaKey && !shiftKey)) {
                    this.unselectAllRows();
                }
                
                //range selection with shift key
                if(this.isMultipleSelection() && event && event.shiftKey) {                    
                    this.selectRowsInRange(row);
                }
                //select current row
                else {
                    this.originRowIndex = row.index();
                    this.cursorIndex = null;
                    this.selectRow(row, silent);
                }
            } 

            PrimeFaces.clearSelection();
        }
    },
    
    onRowDblclick: function(event, row) {
        PrimeFaces.clearSelection();
        
        //Check if rowclick triggered this event not a clickable element in row content
        if($(event.target).is('td,span')) {
            var rowMeta = this.getRowMeta(row);

            this.fireRowSelectEvent(rowMeta.key, 'rowDblselect');
        }
    },
    
    /**
                 * @param r {Row Index || Row Element}
                 */
    findRow: function(r) {
        var row = r;

        if(PrimeFaces.isNumber(r)) {
            row = this.tbody.children('tr:eq(' + r + ')');
        }

        return row;
    },
    
    selectRowsInRange: function(row) {
        var rows = this.tbody.children(),
        rowMeta = this.getRowMeta(row);
        $this = this;
       
        //unselect previously selected rows with shift
        if(this.cursorIndex) {
            var oldCursorIndex = this.cursorIndex,
            rowsToUnselect = oldCursorIndex > this.originRowIndex ? rows.slice(this.originRowIndex, oldCursorIndex + 1) : rows.slice(oldCursorIndex, this.originRowIndex + 1);

            rowsToUnselect.each(function(i, item) {
                $this.unselectRow($(item), true);
            });
        }

        //select rows between cursor and origin
        this.cursorIndex = row.index();

        var rowsToSelect = this.cursorIndex > this.originRowIndex ? rows.slice(this.originRowIndex, this.cursorIndex + 1) : rows.slice(this.cursorIndex, this.originRowIndex + 1);

        rowsToSelect.each(function(i, item) {
            $this.selectRow($(item), true);
        });
        
        this.fireRowSelectEvent(rowMeta.key, 'rowSelect');
    },
    
    selectRow: function(r, silent) {
        var row = this.findRow(r),
        rowMeta = this.getRowMeta(row);

        row.removeClass('ui-state-hover').addClass('ui-state-highlight').attr('aria-selected', true);
        
        if(this.isCheckboxSelectionEnabled()) {
            var checkbox = row.children('td.ui-selection-column').find('> div.ui-chkbox > div.ui-chkbox-box');
            this.selectCheckbox(checkbox);
            this.updateHeaderCheckbox();
        }
        
        this.addSelection(rowMeta.key);

        this.writeSelections();

        if(!silent) {
            this.fireRowSelectEvent(rowMeta.key, 'rowSelect');
        }
    },
    
    unselectRow: function(r, silent) {
        var row = this.findRow(r),
        rowMeta = this.getRowMeta(row);

        row.removeClass('ui-state-highlight').attr('aria-selected', false);
        
        if(this.isCheckboxSelectionEnabled()) {
            var checkbox = row.children('td.ui-selection-column').find('> div.ui-chkbox > div.ui-chkbox-box');
            this.unselectCheckbox(checkbox);
            this.updateHeaderCheckbox();
        }

        this.removeSelection(rowMeta.key);

        this.writeSelections();

        if(!silent) {
            this.fireRowUnselectEvent(rowMeta.key, "rowUnselect");
        }
    },
    
    /**
     * Sends a rowSelectEvent on server side to invoke a rowSelectListener if defined
     */
    fireRowSelectEvent: function(rowKey, behaviorEvent) {
        if(this.cfg.behaviors) {
            var selectBehavior = this.cfg.behaviors[behaviorEvent];

            if(selectBehavior) {
                var ext = {
                    params: [
                    {
                        name: this.id + '_instantSelectedRowKey', 
                        value: rowKey
                    }
                    ]
                };

                selectBehavior.call(this, rowKey, ext);
            }
        }
    },
    
    /**
     * Sends a rowUnselectEvent on server side to invoke a rowUnselectListener if defined
     */
    fireRowUnselectEvent: function(rowKey, behaviorEvent) {
        if(this.cfg.behaviors) {
            var unselectBehavior = this.cfg.behaviors[behaviorEvent];

            if(unselectBehavior) {
                var ext = {
                    params: [
                    {
                        name: this.id + '_instantUnselectedRowKey', 
                        value: rowKey
                    }
                    ]
                };

                unselectBehavior.call(this, rowKey, ext);
            }
        }
    },
    
    /**
     * Selects the corresping row of a radio based column selection
     */
    selectRowWithRadio: function(radio) {
        var row = radio.closest('tr'),
        rowMeta = this.getRowMeta(row);

        //clean previous selection
        this.selection = [];
        row.siblings('.ui-state-highlight').removeClass('ui-state-highlight').attr('aria-selected', false)      //row
        .find('td.ui-selection-column .ui-radiobutton .ui-radiobutton-box').removeClass('ui-state-active')  //radio
        .children('span.ui-radiobutton-icon').removeClass('ui-icon ui-icon-bullet');                        //radio icon
        
        if(this.currentRadio) {
            this.currentRadio.prev().children('input').removeAttr('checked');        
        }
               
        //select current
        if(!radio.hasClass('ui-state-focus')) {
            radio.addClass('ui-state-active');
        }
        radio.children('.ui-radiobutton-icon').addClass('ui-icon ui-icon-bullet');
        radio.prev().children('input').attr('checked', 'checked');
        this.currentRadio = radio;

        //add to selection
        this.addSelection(rowMeta.key);
        row.addClass('ui-state-highlight').attr('aria-selected', true); 

        //save state
        this.writeSelections();

        this.fireRowSelectEvent(rowMeta.key, 'rowSelectRadio');
    },
    
    /**
     * Selects the corresponding row of a checkbox based column selection
     */
    selectRowWithCheckbox: function(checkbox, silent) {
        var row = checkbox.closest('tr'),
        rowMeta = this.getRowMeta(row);

        row.removeClass('ui-state-hover').addClass('ui-state-highlight').attr('aria-selected', true);
        this.selectCheckbox(checkbox);

        this.addSelection(rowMeta.key);

        this.updateHeaderCheckbox();

        this.writeSelections();

        if(!silent) {
            this.fireRowSelectEvent(rowMeta.key, "rowSelectCheckbox");
        }
    },
    
    /**
     * Unselects the corresponding row of a checkbox based column selection
     */
    unselectRowWithCheckbox: function(checkbox, silent) {
        var row = checkbox.closest('tr'),
        rowMeta = this.getRowMeta(row);

        row.removeClass('ui-state-highlight').attr('aria-selected', false);
        this.unselectCheckbox(checkbox);

        this.removeSelection(rowMeta.key);

        this.checkAllToggler.removeClass('ui-state-active').children('span.ui-chkbox-icon:first').removeClass('ui-icon ui-icon-check');

        this.writeSelections();

        if(!silent) {
            this.fireRowUnselectEvent(rowMeta.key, "rowUnselectCheckbox");
        }
    },
    
    unselectAllRows: function() {
        var selectedRows = this.tbody.children('tr.ui-state-highlight');
        for(var i = 0; i < selectedRows.length; i++) {
            var row = selectedRows.eq(i);
            
            row.removeClass('ui-state-highlight').attr('aria-selected', false);
            
            if(this.isCheckboxSelectionEnabled()) {
                var checkbox = row.children('td.ui-selection-column').find('> div.ui-chkbox > div.ui-chkbox-box');
                this.unselectCheckbox(checkbox);
                this.checkAllToggler.removeClass('ui-state-active').children('span.ui-chkbox-icon').removeClass('ui-icon ui-icon-check');
            }
        }
        
        this.selection = [];
        this.writeSelections();
    },
    
    /**
     * Toggles all rows with checkbox
     */
    toggleCheckAll: function() {
        var checkboxes = this.tbody.find('> tr > td.ui-selection-column .ui-chkbox-box:not(.ui-state-disabled)'),
        checked = this.checkAllToggler.hasClass('ui-state-active'),
        $this = this;

        if(checked) {
            this.checkAllToggler.removeClass('ui-state-active').children('span.ui-chkbox-icon').removeClass('ui-icon ui-icon-check');

            checkboxes.each(function() {
                $this.unselectRowWithCheckbox($(this), true);
            });
        } 
        else {
            this.checkAllToggler.addClass('ui-state-active').children('span.ui-chkbox-icon').addClass('ui-icon ui-icon-check');

            checkboxes.each(function() {
                $this.selectRowWithCheckbox($(this), true);
            });
        }

        //save state
        this.writeSelections();

        //fire toggleSelect event
        if(this.cfg.behaviors) {
            var toggleSelectBehavior = this.cfg.behaviors['toggleSelect'];

            if(toggleSelectBehavior) {
                var ext = {
                        params: [{name: this.id + '_checked', value: !checked}
                    ]
                };
                
                toggleSelectBehavior.call(this, null, ext);
            }
        }
    },
    
    selectCheckbox: function(checkbox) {
        if(!checkbox.hasClass('ui-state-focus')) {
            checkbox.addClass('ui-state-active');
        }
        checkbox.children('span.ui-chkbox-icon:first').addClass('ui-icon ui-icon-check');
        checkbox.prev().children('input').prop('checked', true);
    },
    
    unselectCheckbox: function(checkbox) {
        checkbox.removeClass('ui-state-active');
        checkbox.children('span.ui-chkbox-icon:first').removeClass('ui-icon ui-icon-check');
        checkbox.prev().children('input').prop('checked', false);
    },
    
    /**
     * Expands a row to display detail content
     */
    toggleExpansion: function(toggler) {
        var row = toggler.closest('tr'),
        rowIndex = this.getRowMeta(row).index,
        expanded = toggler.hasClass('ui-icon-circle-triangle-s'),
        $this = this;

        //Run toggle expansion if row is not being toggled already to prevent conflicts
        if($.inArray(rowIndex, this.expansionProcess) === -1) {
            if(expanded) {
                this.expansionProcess.push(rowIndex);
                toggler.addClass('ui-icon-circle-triangle-e').removeClass('ui-icon-circle-triangle-s');

                row.next().fadeOut(function() {
                    $(this).remove();

                    $this.expansionProcess = $.grep($this.expansionProcess, function(r) {
                        return (r !== rowIndex);
                    });
                });
                
                this.fireRowCollapseEvent(row);
            }
            else {
                this.expansionProcess.push(rowIndex);
                toggler.addClass('ui-icon-circle-triangle-s').removeClass('ui-icon-circle-triangle-e');

                this.loadExpandedRowContent(row);
            }
        }
    },
    
    loadExpandedRowContent: function(row) {
        var options = {
            source: this.id,
            process: this.id,
            update: this.id,
            formId: this.cfg.formId
        },
        rowIndex = this.getRowMeta(row).index,
        _self = this;

        options.onsuccess = function(responseXML) {
            var xmlDoc = $(responseXML.documentElement),
            updates = xmlDoc.find("update");

            for(var i=0; i < updates.length; i++) {
                var update = updates.eq(i),
                id = update.attr('id'),
                content = update.get(0).childNodes[0].nodeValue;

                if(id == _self.id){
                    row.after(content);
                    row.next().fadeIn();
                }
                else {
                    PrimeFaces.ajax.AjaxUtils.updateElement.call(this, id, content);
                }
            }

            PrimeFaces.ajax.AjaxUtils.handleResponse.call(this, xmlDoc);

            return true;
        };

        options.oncomplete = function() {
            _self.expansionProcess = $.grep(_self.expansionProcess, function(r) {
                return r != rowIndex;
            });
        };

        options.params = [
        {
            name: this.id + '_rowExpansion', 
            value: true
        },

        {
            name: this.id + '_expandedRowIndex', 
            value: rowIndex
        },

        {
            name: this.id + '_encodeFeature', 
            value: true
        },

        {
            name: this.id + '_skipChildren', 
            value: true
        }
        ];
        
        if(this.hasBehavior('rowToggle')) {
            var rowToggleBehavior = this.cfg.behaviors['rowToggle'];

            rowToggleBehavior.call(this, row, options);
        } 
        else {
            PrimeFaces.ajax.AjaxRequest(options); 
        }
    },
    
    fireRowCollapseEvent: function(row) {
        var rowIndex = this.getRowMeta(row).index;
        
        if(this.hasBehavior('rowToggle')) {
            var ext = {
                params: [
                {
                    name: this.id + '_collapsedRowIndex', 
                    value: rowIndex
                }
                ]
            };
        
            var rowToggleBehavior = this.cfg.behaviors['rowToggle'];

            rowToggleBehavior.call(this, row, ext);
        } 
    },
    
    /**
     * Binds editor events non-obstrusively
     */
    bindEditEvents: function() {
        var $this = this;
        this.cfg.cellSeparator = this.cfg.cellSeparator||' ';
        
        if(this.cfg.editMode === 'row') {
            var rowEditorSelector = this.jqId + ' tbody.ui-datatable-data > tr > td > div.ui-row-editor';
            
            $(document).off('click.datatable', rowEditorSelector)
                        .on('click.datatable', rowEditorSelector, null, function(e) {
                            var element = $(e.target),
                            row = element.closest('tr');
                            
                            if(element.hasClass('ui-icon-pencil')) {
                                $this.showEditors(row);
                                element.hide().siblings().show();
                            }
                            else if(element.hasClass('ui-icon-check')) {
                                $this.saveRowEdit(row);
                            }
                            else if(element.hasClass('ui-icon-close')) {
                                $this.cancelRowEdit(row);
                            }
                        });
        }
        else if(this.cfg.editMode === 'cell') {
            var cellSelector = this.jqId + ' tbody.ui-datatable-data tr td.ui-editable-column';
            
            $(document).off('click.datatable-cell', cellSelector)
                        .on('click.datatable-cell', cellSelector, null, function(e) {
                            $this.incellClick = true;
                            
                            var cell = $(this);
                            if(!cell.hasClass('ui-cell-editing')) {
                                $this.showCellEditor($(this));
                            }
                        });
                        
            $(document).off('click.datatable-cell-blur' + this.id)
                        .on('click.datatable-cell-blur' + this.id, function(e) {                            
                            if(!$this.incellClick && $this.currentCell && !$this.contextMenuClick) {
                                $this.saveCell($this.currentCell);
                            }
                            
                            $this.incellClick = false;
                            $this.contextMenuClick = false;
                        });
        }
    },
    
    showEditors: function(row) {
        row.addClass('ui-state-highlight ui-row-editing').children('td.ui-editable-column').each(function() {
            var column = $(this);

            column.find('.ui-cell-editor-output').hide();
            column.find('.ui-cell-editor-input').show();
        });
        
        if(this.hasBehavior('rowEditInit')) {
            var rowEditInitBehavior = this.cfg.behaviors['rowEditInit'],
            rowIndex = this.getRowMeta(row).index;
            
            var ext = {
                params: [{name: this.id + '_rowEditIndex', value: rowIndex}]
            };

            rowEditInitBehavior.call(this, null, ext);
        }
    },
    
    showCellEditor: function(c) {
        this.incellClick = true;
        
        var cell = null,
        $this = this;
                    
        if(c) {
            cell = c;
                        
            //remove contextmenu selection highlight
            if(this.contextMenuCell) {
                this.contextMenuCell.parent().removeClass('ui-state-highlight');
            }
        }
        else {
            cell = this.contextMenuCell;
        }
        
        if(this.currentCell) {
            $this.saveCell(this.currentCell);
        }
        
        this.currentCell = cell;
                
        var cellEditor = cell.children('div.ui-cell-editor'),
        displayContainer = cellEditor.children('div.ui-cell-editor-output'),
        inputContainer = cellEditor.children('div.ui-cell-editor-input'),
        inputs = inputContainer.find(':input:enabled'),
        multi = inputs.length > 1;
                                        
        cell.addClass('ui-state-highlight ui-cell-editing');
        displayContainer.hide();
        inputContainer.show();
        inputs.eq(0).focus().select();
        
        //metadata
        if(multi) {
            var oldValues = [];
            for(var i = 0; i < inputs.length; i++) {
                oldValues.push(inputs.eq(i).val());
            }
            
            cell.data('multi-edit', true);
            cell.data('old-value', oldValues);
        } 
        else {
            cell.data('multi-edit', false);
            cell.data('old-value', inputs.eq(0).val());
        }
        
        //bind events on demand
        if(!cell.data('edit-events-bound')) {
            cell.data('edit-events-bound', true);
            
            inputs.on('keydown.datatable-cell', function(e) {
                    var keyCode = $.ui.keyCode,
                    shiftKey = e.shiftKey,
                    key = e.which,
                    input = $(this);

                    if(key === keyCode.ENTER || key == keyCode.NUMPAD_ENTER) {
                        $this.saveCell(cell);

                        e.preventDefault();
                    }
                    else if(key === keyCode.TAB) {
                        if(multi) {
                            var focusIndex = shiftKey ? input.index() - 1 : input.index() + 1;

                            if(focusIndex < 0 || (focusIndex === inputs.length)) {
                                $this.tabCell(cell, !shiftKey);                                
                            } else {
                                inputs.eq(focusIndex).focus();
                            }
                        }
                        else {
                            $this.tabCell(cell, !shiftKey);
                        }
                        
                        e.preventDefault();
                    }
                });
        }        
    },
    
    tabCell: function(cell, forward) {
        var targetCell = forward ? cell.next() : cell.prev();
        if(targetCell.length == 0) {
            var tabRow = forward ? cell.parent().next() : cell.parent().prev();
            targetCell = forward ? tabRow.children('td.ui-editable-column:first') : tabRow.children('td.ui-editable-column:last');
        }

        this.showCellEditor(targetCell);
    },
    
    saveCell: function(cell) {
        var inputs = cell.find('div.ui-cell-editor-input :input:enabled'),
        changed = false,
        $this = this;
        
        if(cell.data('multi-edit')) {
            var oldValues = cell.data('old-value');
            for(var i = 0; i < inputs.length; i++) {
                if(inputs.eq(i).val() != oldValues[i]) {
                    changed = true;
                    break;
                }
            }
        } 
        else {
            changed = (inputs.eq(0).val() != cell.data('old-value'));
        }
        
        if(changed)
            $this.doCellEditRequest(cell);
        else
            $this.viewMode(cell);
        
        this.currentCell = null;
    },
        
    viewMode: function(cell) {
        var cellEditor = cell.children('div.ui-cell-editor'),
        editableContainer = cellEditor.children('div.ui-cell-editor-input'),
        displayContainer = cellEditor.children('div.ui-cell-editor-output');
        
        cell.removeClass('ui-cell-editing ui-state-error ui-state-highlight');
        displayContainer.show();
        editableContainer.hide();
        cell.removeData('old-value').removeData('multi-edit');
    },
    
    doCellEditRequest: function(cell) {
        var rowMeta = this.getRowMeta(cell.closest('tr')),
        cellEditor = cell.children('.ui-cell-editor'),
        cellEditorId = cellEditor.attr('id'),
        cellIndex = cell.index(),
        cellInfo = rowMeta.index + ',' + cellIndex,
        $this = this;

        var options = {
            source: this.id,
            process: this.id,
            update: this.id,
            params: [
                    {name: this.id + '_encodeFeature', value: true},
                    {name: this.id + '_cellInfo', value: cellInfo},
                    {name: cellEditorId, value: cellEditorId}
                ],
            onsuccess: function(responseXML) {
                var xmlDoc = $(responseXML.documentElement),
                updates = xmlDoc.find("update");

                for(var i=0; i < updates.length; i++) {
                    var update = updates.eq(i),
                    id = update.attr('id'),
                    content = update.get(0).childNodes[0].nodeValue;

                    if(id === $this.id)
                        cellEditor.children('.ui-cell-editor-output').html(content);
                    else
                        PrimeFaces.ajax.AjaxUtils.updateElement.call(this, id, content);
                }

                PrimeFaces.ajax.AjaxUtils.handleResponse.call(this, xmlDoc);

                return true;
            }
            ,oncomplete: function(xhr, status, args) {                            
                if(args.validationFailed)
                    cell.addClass('ui-state-error');
                else
                    $this.viewMode(cell);
            }
        };

        if(this.hasBehavior('cellEdit')) {
            this.cfg.behaviors['cellEdit'].call(this, cell, options);
        } 
        else {
            PrimeFaces.ajax.AjaxRequest(options);
        }
    },
    
    /**
     * Saves the edited row
     */
    saveRowEdit: function(rowEditor) {
        this.doRowEditRequest(rowEditor, 'save');
    },
    
    /**
     * Cancels row editing
     */
    cancelRowEdit: function(rowEditor) {
        this.doRowEditRequest(rowEditor, 'cancel');
    },
    
    /**
     * Sends an ajax request to handle row save or cancel
     */
    doRowEditRequest: function(rowEditor, action) {
        var row = rowEditor.closest('tr'),
        options = {
            source: this.id,
            process: this.id,
            update: this.id,
            formId: this.cfg.formId
        },
        expanded = row.hasClass('ui-expanded-row'),
        $this = this;

        options.onsuccess = function(responseXML) {
            var xmlDoc = $(responseXML.documentElement),
            updates = xmlDoc.find("update");

            PrimeFaces.ajax.AjaxUtils.handleResponse.call(this, xmlDoc);

            for(var i=0; i < updates.length; i++) {
                var update = updates.eq(i),
                id = update.attr('id'),
                content = update.get(0).childNodes[0].nodeValue;

                if(id == $this.id) {
                    if(this.args.validationFailed) {
                        content = content.replace('ui-widget-content', 'ui-widget-content ui-row-editing ui-state-error');
                    }
                    
                    //remove row expansion
                    if(expanded) {
                        row.next().remove();
                    }

                    row.replaceWith(content);
                }
                else {
                    PrimeFaces.ajax.AjaxUtils.updateElement.call(this, id, content);
                }
            }

            return true;
        };

        options.params = [
            {name: this.id + '_rowEditIndex', value: this.getRowMeta(row).index},
            {name: this.id + '_rowEditAction', value: action},
            {name: this.id + '_encodeFeature', value: true}
        ];

        if(action === 'save') {
            row.find('div.ui-cell-editor').each(function() {
                options.params.push({name: this.id, value: this.id});
            });
        }

        if(action === 'save' && this.hasBehavior('rowEdit')) {
            this.cfg.behaviors['rowEdit'].call(this, row, options);
        }
        else if(action === 'cancel' && this.hasBehavior('rowEditCancel')) {
            this.cfg.behaviors['rowEditCancel'].call(this, row, options);
        }
        else {
            PrimeFaces.ajax.AjaxRequest(options); 
        }
    },

    /**
     * Returns the paginator instance if any defined
     */
    getPaginator: function() {
        return this.paginator;
    },
    
    /**
     * Writes selected row ids to state holder
     */
    writeSelections: function() {
        $(this.selectionHolder).val(this.selection.join(','));
    },
    
    isSingleSelection: function() {
        return this.cfg.selectionMode == 'single';
    },
    
    isMultipleSelection: function() {
        return this.cfg.selectionMode == 'multiple' || this.isCheckboxSelectionEnabled();
    },
    
    /**
     * Clears the selection state
     */
    clearSelection: function() {
        this.selection = [];

        $(this.selectionHolder).val('');
    },
    
    /**
     * Returns true|false if selection is enabled|disabled
     */
    isSelectionEnabled: function() {
        return this.cfg.selectionMode != undefined || this.cfg.columnSelectionMode != undefined;
    },

    /**
     * Returns true|false if checkbox selection is enabled|disabled
     */
    isCheckboxSelectionEnabled: function() {
        return this.cfg.selectionMode === 'checkbox';
    },
            
    /**
     * Clears table filters
     */
    clearFilters: function() {
        this.thead.find('> tr > th.ui-filter-column > .ui-column-filter').val('');
        $(this.jqId + '\\:globalFilter').val('');

        this.filter();
    },
    
    setupResizableColumns: function() {
        this.fixColumnWidths();
        
        if(!this.cfg.liveResize) {
            this.resizerHelper = $('<div class="ui-column-resizer-helper ui-state-highlight"></div>').appendTo(this.jq);
        }
        
        this.thead.find('> tr > th.ui-resizable-column').prepend('<span class="ui-column-resizer">&nbsp;</span>').filter(':last-child')
                .children('span.ui-column-resizer').hide();        
        var resizers = this.thead.find('> tr > th > span.ui-column-resizer'),
        $this = this;
            
        resizers.draggable({
            axis: 'x',
            start: function() {
                if($this.cfg.liveResize) {
                    $this.jq.css('cursor', 'col-resize');
                }
                else {
                    var height = $this.cfg.scrollable ? $this.scrollBody.height() : $this.thead.parent().height() - $this.thead.height() - 1;
                    $this.resizerHelper.height(height);
                    $this.resizerHelper.show();
                }
            },
            drag: function(event, ui) {
                if($this.cfg.liveResize) {
                    $this.resize(event, ui);
                }
                else {
                    $this.resizerHelper.offset({
                        left: ui.helper.offset().left + ui.helper.width() / 2, 
                        top: $this.thead.offset().top + $this.thead.height()
                    });  
                }                
            },
            stop: function(event, ui) {
                var columnHeader = ui.helper.parent();
                ui.helper.css('left','');
                
                if($this.cfg.liveResize) {
                    $this.jq.css('cursor', 'default');
                } else {
                    $this.resize(event, ui);
                    $this.resizerHelper.hide();
                }
                
                var options = {
                    source: $this.id,
                    process: $this.id,
                    params: [
                        {name: $this.id + '_colResize', value: true},
                        {name: $this.id + '_columnId', value: columnHeader.attr('id')},
                        {name: $this.id + '_width', value: columnHeader.width()},
                        {name: $this.id + '_height', value: columnHeader.height()}
                    ]
                }
                
                if($this.hasBehavior('colResize')) {
                    $this.cfg.behaviors['colResize'].call($this, event, options);
                }
            },
            containment: this.jq
        });
    },
    
    resize: function(event, ui) {
        var columnHeader = ui.helper.parent(),
        nextColumnHeader = columnHeader.next(),
        change = null, newWidth = null, nextColumnWidth = null;
        
        if(this.cfg.liveResize) {
            change = columnHeader.outerWidth() - (event.pageX - columnHeader.offset().left),
            newWidth = (columnHeader.width() - change),
            nextColumnWidth = (nextColumnHeader.width() + change);
        } 
        else {
            change = (ui.position.left - ui.originalPosition.left),
            newWidth = (columnHeader.width() + change),
            nextColumnWidth = (nextColumnHeader.width() - change);
        }
        
        if(newWidth > 15 && nextColumnWidth > 15) {
            columnHeader.width(newWidth);
            nextColumnHeader.width(nextColumnWidth);
            var colIndex = columnHeader.index();

            if(this.cfg.scrollable) {
                var padding = columnHeader.innerWidth() - columnHeader.width();
                this.colgroup.children().eq(colIndex).css('width', newWidth + padding + 1 + 'px');
                this.colgroup.children().eq(colIndex + 1).css('width', nextColumnWidth + padding + 1 + 'px');
                if(this.footerCols.length > 0) {
                    var footerCol = this.footerCols.eq(colIndex),
                    nextFooterCol = footerCol.next();

                    footerCol.width(newWidth);
                    nextFooterCol.width(nextColumnWidth);
                }
            }
        }
    },
    
    hasBehavior: function(event) {
        if(this.cfg.behaviors) {
            return this.cfg.behaviors[event] != undefined;
        }
    
        return false;
    },
    
    /**
     * Remove given rowIndex from selection
     */
    removeSelection: function(rowIndex) {        
        this.selection = $.grep(this.selection, function(value) {
            return value != rowIndex;
        });
    },
    
    /**
     * Adds given rowIndex to selection if it doesn't exist already
     */
    addSelection: function(rowIndex) {
        if(!this.isSelected(rowIndex)) {
            this.selection.push(rowIndex);
        }
    },
    
    /**
     * Finds if given rowIndex is in selection
     */
    isSelected: function(rowIndex) {
        return PrimeFaces.inArray(this.selection, rowIndex);
    },
    
    getRowMeta: function(row) {
        var meta = {
            index: row.data('ri'),
            key:  row.attr('data-rk')
        };

        return meta;
    },
    
    setupDraggableColumns: function() {
        this.orderStateHolder = $(this.jqId + '_columnOrder');
        this.saveColumnOrder();
        
        this.dragIndicatorTop = $('<div id="' + this.id + '_dnd_top" class="ui-column-dnd-top"><span class="ui-icon ui-icon-arrowthick-1-s" /></div>').appendTo(document.body);
        this.dragIndicatorBottom = $('<div id="' + this.id + '_dnd_bottom" class="ui-column-dnd-bottom"><span class="ui-icon ui-icon-arrowthick-1-n" /></div>').appendTo(document.body);

        var $this = this;

        $(this.jqId + ' thead th').draggable({
            appendTo: 'body',
            opacity: 0.75,
            cursor: 'move',
            scope: this.id,
            cancel: ':input,.ui-column-resizer',
            drag: function(event, ui) {
                var droppable = ui.helper.data('droppable-column');

                if(droppable) {
                    var droppableOffset = droppable.offset(),
                    topArrowY = droppableOffset.top - 10,
                    bottomArrowY = droppableOffset.top + droppable.height() + 8,
                    arrowX = null;
                    
                    //calculate coordinates of arrow depending on mouse location
                    if(event.originalEvent.pageX >= droppableOffset.left + (droppable.width() / 2)) {
                        var nextDroppable = droppable.next();
                        if(nextDroppable.length == 1)
                            arrowX = nextDroppable.offset().left - 9;
                        else
                            arrowX = droppable.offset().left + droppable.innerWidth() - 9;
                            
                        ui.helper.data('drop-location', 1);     //right
                    }
                    else {
                        arrowX = droppableOffset.left  - 9;
                        ui.helper.data('drop-location', -1);    //left
                    }
                    
                    $this.dragIndicatorTop.offset({
                        'left': arrowX, 
                        'top': topArrowY
                    }).show();
                    
                    $this.dragIndicatorBottom.offset({
                        'left': arrowX, 
                        'top': bottomArrowY
                    }).show();
                }
            },
            stop: function(event, ui) {
                //hide dnd arrows
                $this.dragIndicatorTop.css({
                    'left':0, 
                    'top':0
                }).hide();
                
                $this.dragIndicatorBottom.css({
                    'left':0, 
                    'top':0
                }).hide();
            },
            helper: function() {
                var header = $(this),
                helper = $('<div class="ui-widget ui-state-default" style="padding:4px 10px;text-align:center;"></div>');

                helper.width(header.width());
                helper.height(header.height());

                helper.html(header.html());

                return helper.get(0);
            }
        }).droppable({
            hoverClass:'ui-state-highlight',
            tolerance:'pointer',
            scope: this.id,
            over: function(event, ui) {
                ui.helper.data('droppable-column', $(this));
            },
            drop: function(event, ui) {
                var draggedColumn = ui.draggable,
                dropLocation = ui.helper.data('drop-location'),
                droppedColumn =  $(this);
                                
                var draggedCells = $this.tbody.find('> tr > td:nth-child(' + (draggedColumn.index() + 1) + ')'),
                droppedCells = $this.tbody.find('> tr > td:nth-child(' + (droppedColumn.index() + 1) + ')');
                
                //drop right
                if(dropLocation > 0) {
                    if($this.cfg.resizableColumns) {
                        if(droppedColumn.next().length == 0) {
                            droppedColumn.children('span.ui-column-resizer').show();
                            draggedColumn.children('span.ui-column-resizer').hide();
                        }
                    }
                    
                    draggedColumn.insertAfter(droppedColumn);

                    draggedCells.each(function(i, item) {
                        $(this).insertAfter(droppedCells.eq(i));
                    });
                }
                //drop left
                else {
                    draggedColumn.insertBefore(droppedColumn);

                    draggedCells.each(function(i, item) {
                        $(this).insertBefore(droppedCells.eq(i));
                    });
                }
                
                //align widths
                if($this.cfg.scrollable) {
                    $this.columnWidthsFixed = false;
                    $this.fixColumnWidths();
                }
               
                //save order
                $this.saveColumnOrder();

                //fire colReorder event
                if($this.cfg.behaviors) {
                    var columnReorderBehavior = $this.cfg.behaviors['colReorder'];

                    if(columnReorderBehavior) {            
                        columnReorderBehavior.call($this);
                    }
                }
            }
        });
    },
    
    saveColumnOrder: function() {
        var columnIds = [],
        columns = $(this.jqId + ' thead:first th');

        columns.each(function(i, item) {
            columnIds.push($(item).attr('id'));
        });

        this.orderStateHolder.val(columnIds.join(','));
    },
    
    /**
     * Returns if there is any data displayed
     */
    isEmpty: function() {
        return this.tbody.children('tr.ui-datatable-empty-message').length == 1;
    },
    
    getSelectedRowsCount: function() {
        return this.isSelectionEnabled() ? this.selection.length : 0;
    },
    
    updateHeaderCheckbox: function() {
        if(this.isEmpty()) {
            this.checkAllToggler.removeClass('ui-state-active').children('span.ui-chkbox-icon').removeClass('ui-icon ui-icon-check');
        }
        else {
            var checkboxes = $(this.jqId + ' tbody.ui-datatable-data:first > tr > td.ui-selection-column .ui-chkbox-box'),
            uncheckedBoxes = $.grep(checkboxes, function(element) {
                var checkbox = $(element),
                disabled = checkbox.hasClass('ui-state-disabled'),
                checked = checkbox.hasClass('ui-state-active');

                return !(checked || disabled); 
            });
            
            if(uncheckedBoxes.length == 0)
                this.checkAllToggler.addClass('ui-state-active').children('span.ui-chkbox-icon').addClass('ui-icon ui-icon-check');
            else
                this.checkAllToggler.removeClass('ui-state-active').children('span.ui-chkbox-icon').removeClass('ui-icon ui-icon-check');
        }
    },
            
    setupStickyHeader: function() {
        var offset = this.thead.parent().offset(),
        win = $(window),
        $this = this,
        stickyNamespace = 'scroll.' + this.id;

        this.cloneContainer = $('<div class="ui-datatable ui-datatable-sticky ui-widget"><table></table></div>');
        this.clone = this.thead.clone(true);
        this.cloneContainer.children('table').append(this.clone);
        
        this.cloneContainer.css({
            position: 'absolute',
            width: this.thead.parent().width(),
            top: offset.top,
            left: offset.left
        })
        .appendTo(document.body);

        var cloneContainerOffset = this.cloneContainer.offset();
        this.initialState = {
            top: cloneContainerOffset.top,
            bottom: cloneContainerOffset.top + this.tbody.height()
        }
        
        win.off(stickyNamespace).on(stickyNamespace, function() {
            var scrollTop = win.scrollTop();
            if(scrollTop > $this.initialState.top) {
                if(!$this.fixed) {
                    $this.cloneContainer.css({
                        'position': 'fixed',
                        'top': 0,
                        'z-index': ++PrimeFaces.zindex
                    })
                    .addClass('ui-shadow ui-sticky');

                    $this.fixed = true;
                }
                
                if(scrollTop >= $this.initialState.bottom) {
                    $this.cloneContainer.hide();
                }
                else {
                    $this.cloneContainer.show();
                }
            }
            else {
                if($this.fixed) {
                    $this.cloneContainer.css({
                        position: 'absolute',
                        top: $this.initialState.top
                    })
                    .removeClass('ui-shadow ui-sticky');

                    $this.fixed = false;
                }
            }
        });
    }

});