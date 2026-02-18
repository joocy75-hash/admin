using System.Collections.Generic;
using System.Linq;
using UnityEditor;
using UnityEngine;
using UnityEngine.UIElements;

namespace AdminPanel.Editor
{
    public class MemberTreeViewWindow : EditorWindow
    {
        TreeView _treeView;
        TextField _searchField;
        Label _statusLabel;
        List<MemberData> _allRoots;
        int _totalCount;

        [MenuItem("Admin Panel/Member Tree View")]
        public static void ShowWindow()
        {
            var wnd = GetWindow<MemberTreeViewWindow>();
            wnd.titleContent = new GUIContent("회원 트리 관리");
            wnd.minSize = new Vector2(800, 500);
        }

        void CreateGUI()
        {
            var root = rootVisualElement;

            // Load USS
            var styleSheet = AssetDatabase.LoadAssetAtPath<StyleSheet>(
                FindUSSPath("MemberTreeView.uss"));
            if (styleSheet != null)
                root.styleSheets.Add(styleSheet);

            root.AddToClassList("root");

            // Header
            var header = new VisualElement();
            header.AddToClassList("header");

            var titleBlock = new VisualElement();
            titleBlock.AddToClassList("title-block");

            var title = new Label("MEMBER MANAGEMENT");
            title.AddToClassList("page-title");
            titleBlock.Add(title);

            _statusLabel = new Label("Loading...");
            _statusLabel.AddToClassList("page-subtitle");
            titleBlock.Add(_statusLabel);
            header.Add(titleBlock);

            var actions = new VisualElement();
            actions.AddToClassList("header-actions");

            var expandBtn = new Button(ExpandAll) { text = "Expand All" };
            expandBtn.AddToClassList("btn-secondary");
            actions.Add(expandBtn);

            var collapseBtn = new Button(CollapseAll) { text = "Collapse All" };
            collapseBtn.AddToClassList("btn-secondary");
            actions.Add(collapseBtn);

            var refreshBtn = new Button(RefreshData) { text = "Refresh" };
            refreshBtn.AddToClassList("btn-primary");
            actions.Add(refreshBtn);

            header.Add(actions);
            root.Add(header);

            // Search bar
            var filterBar = new VisualElement();
            filterBar.AddToClassList("filter-bar");

            _searchField = new TextField();
            _searchField.AddToClassList("search-input");
            _searchField.value = "";
            _searchField.RegisterValueChangedCallback(OnSearchChanged);
            // placeholder via attribute
            var placeholder = new Label("Search by ID, Username, Name...");
            placeholder.AddToClassList("search-placeholder");
            _searchField.Add(placeholder);
            _searchField.RegisterCallback<FocusInEvent>(_ => placeholder.style.display = DisplayStyle.None);
            _searchField.RegisterCallback<FocusOutEvent>(_ =>
            {
                if (string.IsNullOrEmpty(_searchField.value))
                    placeholder.style.display = DisplayStyle.Flex;
            });

            filterBar.Add(_searchField);

            // Rank legend
            var legend = new VisualElement();
            legend.AddToClassList("legend");
            legend.Add(CreateLegendItem("부본사", "rank-subhq"));
            legend.Add(CreateLegendItem("총판", "rank-distributor"));
            legend.Add(CreateLegendItem("대리점", "rank-agency"));
            filterBar.Add(legend);

            root.Add(filterBar);

            // Column headers
            var colHeader = new VisualElement();
            colHeader.AddToClassList("column-header");
            colHeader.Add(CreateColumnLabel("ID", 60));
            colHeader.Add(CreateColumnLabel("USERNAME", 140));
            colHeader.Add(CreateColumnLabel("NAME", 100));
            colHeader.Add(CreateColumnLabel("PHONE", 130));
            colHeader.Add(CreateColumnLabel("RANK", 70));
            colHeader.Add(CreateColumnLabel("BALANCE", 120));
            colHeader.Add(CreateColumnLabel("POINTS", 70));
            colHeader.Add(CreateColumnLabel("REFERRALS", 80));
            colHeader.Add(CreateColumnLabel("STATUS", 60));
            colHeader.Add(CreateColumnLabel("JOINED", 90));
            root.Add(colHeader);

            // TreeView
            _treeView = new TreeView();
            _treeView.AddToClassList("member-tree");
            _treeView.makeItem = MakeItem;
            _treeView.bindItem = BindItem;
            _treeView.fixedItemHeight = 40;
            _treeView.selectionType = SelectionType.Single;
            _treeView.selectionChanged += OnSelectionChanged;

            root.Add(_treeView);

            // Footer
            var footer = new VisualElement();
            footer.AddToClassList("footer");
            var footerLabel = new Label("Unity UI Toolkit TreeView — Admin Panel");
            footerLabel.AddToClassList("footer-text");
            footer.Add(footerLabel);
            root.Add(footer);

            RefreshData();
        }

        // --- makeItem: create row layout ---
        VisualElement MakeItem()
        {
            var row = new VisualElement();
            row.AddToClassList("tree-row");

            row.Add(CreateCell("cell-id", 60));
            row.Add(CreateCell("cell-username", 140));
            row.Add(CreateCell("cell-name", 100));
            row.Add(CreateCell("cell-phone", 130));

            var rankBadge = new Label();
            rankBadge.AddToClassList("cell-rank");
            rankBadge.style.width = 70;
            row.Add(rankBadge);

            row.Add(CreateCell("cell-balance", 120));
            row.Add(CreateCell("cell-points", 70));
            row.Add(CreateCell("cell-referrals", 80));

            var statusBadge = new Label();
            statusBadge.AddToClassList("cell-status");
            statusBadge.style.width = 60;
            row.Add(statusBadge);

            row.Add(CreateCell("cell-date", 90));

            return row;
        }

        // --- bindItem: populate each row with data ---
        void BindItem(VisualElement element, int index)
        {
            var itemData = _treeView.GetItemDataForIndex<MemberData>(index);
            if (itemData == null) return;

            SetCellText(element, "cell-id", itemData.Id.ToString());
            SetCellText(element, "cell-username", itemData.Username);
            SetCellText(element, "cell-name", itemData.RealName);
            SetCellText(element, "cell-phone", itemData.Phone ?? "-");

            var rankLabel = element.Q<Label>(className: "cell-rank");
            if (rankLabel != null)
            {
                rankLabel.text = itemData.RankLabel;
                rankLabel.RemoveFromClassList("rank-subhq");
                rankLabel.RemoveFromClassList("rank-distributor");
                rankLabel.RemoveFromClassList("rank-agency");
                rankLabel.AddToClassList(itemData.Rank switch
                {
                    MemberRank.SubHQ => "rank-subhq",
                    MemberRank.Distributor => "rank-distributor",
                    _ => "rank-agency"
                });
            }

            SetCellText(element, "cell-balance", $"{itemData.Balance:N0}");
            SetCellText(element, "cell-points", itemData.Points.ToString("N0"));
            SetCellText(element, "cell-referrals", itemData.DirectReferralCount.ToString());

            var statusLabel = element.Q<Label>(className: "cell-status");
            if (statusLabel != null)
            {
                statusLabel.text = itemData.StatusLabel;
                statusLabel.RemoveFromClassList("status-active");
                statusLabel.RemoveFromClassList("status-suspended");
                statusLabel.RemoveFromClassList("status-banned");
                statusLabel.AddToClassList(itemData.Status switch
                {
                    MemberStatus.Active => "status-active",
                    MemberStatus.Suspended => "status-suspended",
                    MemberStatus.Banned => "status-banned",
                    _ => "status-active"
                });
            }

            SetCellText(element, "cell-date", itemData.CreatedAt.ToString("yyyy-MM-dd"));
        }

        // --- Data ---
        void RefreshData()
        {
            _allRoots = MemberSampleData.CreateSampleTree();
            _totalCount = CountAll(_allRoots);
            _statusLabel.text = $"TOTAL {_totalCount} MEMBERS";
            PopulateTree(_allRoots);
        }

        void PopulateTree(List<MemberData> roots)
        {
            int nextId = 0;
            var treeRoots = new List<TreeViewItemData<MemberData>>();

            foreach (var root in roots)
                treeRoots.Add(BuildTreeItem(root, ref nextId));

            _treeView.SetRootItems(treeRoots);
            _treeView.Rebuild();
        }

        TreeViewItemData<MemberData> BuildTreeItem(MemberData member, ref int nextId)
        {
            var children = new List<TreeViewItemData<MemberData>>();
            foreach (var child in member.Children)
                children.Add(BuildTreeItem(child, ref nextId));

            return new TreeViewItemData<MemberData>(nextId++, member, children);
        }

        // --- Search ---
        void OnSearchChanged(ChangeEvent<string> evt)
        {
            var query = evt.newValue?.Trim().ToLowerInvariant();
            if (string.IsNullOrEmpty(query))
            {
                PopulateTree(_allRoots);
                return;
            }

            var filtered = FilterTree(_allRoots, query);
            PopulateTree(filtered);
            ExpandAll();
        }

        List<MemberData> FilterTree(List<MemberData> nodes, string query)
        {
            var result = new List<MemberData>();
            foreach (var node in nodes)
            {
                var filteredChildren = FilterTree(node.Children, query);
                bool selfMatch =
                    node.Id.ToString().Contains(query) ||
                    node.Username.ToLowerInvariant().Contains(query) ||
                    (node.RealName?.ToLowerInvariant().Contains(query) ?? false) ||
                    (node.Phone?.Contains(query) ?? false);

                if (selfMatch || filteredChildren.Count > 0)
                {
                    var clone = new MemberData(
                        node.Id, node.Username, node.RealName, node.Phone,
                        node.Rank, node.Status, node.Balance, node.Points,
                        node.ParentId, node.CreatedAt)
                    {
                        DirectReferralCount = node.DirectReferralCount,
                        Children = filteredChildren
                    };
                    result.Add(clone);
                }
            }
            return result;
        }

        // --- Actions ---
        void ExpandAll()
        {
            _treeView.ExpandAll();
        }

        void CollapseAll()
        {
            _treeView.CollapseAll();
        }

        void OnSelectionChanged(IEnumerable<object> selection)
        {
            var selected = selection.FirstOrDefault() as MemberData;
            if (selected != null)
                Debug.Log($"[MemberTree] Selected: {selected.Username} (ID: {selected.Id}, Rank: {selected.RankLabel})");
        }

        // --- Helpers ---
        static VisualElement CreateCell(string className, float width)
        {
            var label = new Label();
            label.AddToClassList(className);
            label.style.width = width;
            return label;
        }

        static void SetCellText(VisualElement row, string className, string text)
        {
            var label = row.Q<Label>(className: className);
            if (label != null) label.text = text;
        }

        static Label CreateColumnLabel(string text, float width)
        {
            var label = new Label(text);
            label.AddToClassList("col-label");
            label.style.width = width;
            return label;
        }

        static VisualElement CreateLegendItem(string text, string colorClass)
        {
            var item = new VisualElement();
            item.AddToClassList("legend-item");

            var dot = new VisualElement();
            dot.AddToClassList("legend-dot");
            dot.AddToClassList(colorClass);
            item.Add(dot);

            var label = new Label(text);
            label.AddToClassList("legend-label");
            item.Add(label);

            return item;
        }

        static string FindUSSPath(string filename)
        {
            var guids = AssetDatabase.FindAssets(filename.Replace(".uss", "") + " t:StyleSheet");
            if (guids.Length > 0)
                return AssetDatabase.GUIDToAssetPath(guids[0]);

            // Fallback: search common paths
            string[] searchPaths =
            {
                "Assets/Editor/" + filename,
                "Assets/UI/" + filename,
                "Assets/Styles/" + filename,
            };
            foreach (var p in searchPaths)
            {
                if (System.IO.File.Exists(p))
                    return p;
            }
            return "Assets/Editor/" + filename;
        }
    }
}
