using System.Collections.Generic;
using NUnit.Framework;
using UnityEngine;
using Webium.Core;
using Webium.Layout;

namespace Webium.Tests.Layout
{
    [TestFixture]
    public class YogaLayoutEngineTests
    {
        private VirtualDOM _dom;

        [SetUp]
        public void SetUp()
        {
            _dom = new VirtualDOM();
        }

        /// <summary>
        /// Row layout: root (800x600) with flex-direction=row, two children each 200x100.
        /// Expected: child A at (0,0) 200x100, child B at (200,0) 200x100.
        /// </summary>
        [Test]
        public void ComputeLayout_RowWithTwoChildren_PositionsHorizontally()
        {
            // Arrange
            var root = _dom.Root;
            root.InlineStyles["flex-direction"] = "row";

            var childA = _dom.CreateElement(NodeTag.Div);
            childA.InlineStyles["width"] = "200px";
            childA.InlineStyles["height"] = "100px";
            _dom.AppendChild(root, childA);

            var childB = _dom.CreateElement(NodeTag.Div);
            childB.InlineStyles["width"] = "200px";
            childB.InlineStyles["height"] = "100px";
            _dom.AppendChild(root, childB);

            var dirtyNodes = new List<VirtualNode> { root, childA, childB };
            var engine = new YogaLayoutEngine(_dom, 800f, 600f);
            var treeMgr = new YogaTreeManager();

            // Act
            engine.ComputeLayout(dirtyNodes);

            // Assert — verify Yoga computed layout values
            treeMgr.SyncTree(root);
            var yogaA = treeMgr.GetYogaNode(childA);
            var yogaB = treeMgr.GetYogaNode(childB);

            Assert.AreEqual(0f, yogaA.LayoutX, 0.1f);
            Assert.AreEqual(0f, yogaA.LayoutY, 0.1f);
            Assert.AreEqual(200f, yogaA.LayoutWidth, 0.1f);
            Assert.AreEqual(100f, yogaA.LayoutHeight, 0.1f);

            Assert.AreEqual(200f, yogaB.LayoutX, 0.1f);
            Assert.AreEqual(0f, yogaB.LayoutY, 0.1f);
            Assert.AreEqual(200f, yogaB.LayoutWidth, 0.1f);
            Assert.AreEqual(100f, yogaB.LayoutHeight, 0.1f);
        }

        /// <summary>
        /// Column layout (default): root (800x600), two children each 300x150.
        /// Expected: child A at (0,0) 300x150, child B at (0,150) 300x150.
        /// </summary>
        [Test]
        public void ComputeLayout_ColumnWithTwoChildren_PositionsVertically()
        {
            // Arrange
            var root = _dom.Root;
            root.InlineStyles["flex-direction"] = "column";

            var childA = _dom.CreateElement(NodeTag.Div);
            childA.InlineStyles["width"] = "300px";
            childA.InlineStyles["height"] = "150px";
            _dom.AppendChild(root, childA);

            var childB = _dom.CreateElement(NodeTag.Div);
            childB.InlineStyles["width"] = "300px";
            childB.InlineStyles["height"] = "150px";
            _dom.AppendChild(root, childB);

            var dirtyNodes = new List<VirtualNode> { root, childA, childB };
            var engine = new YogaLayoutEngine(_dom, 800f, 600f);
            var treeMgr = new YogaTreeManager();

            // Act
            engine.ComputeLayout(dirtyNodes);

            // Assert — verify Yoga computed layout values
            treeMgr.SyncTree(root);
            var yogaA = treeMgr.GetYogaNode(childA);
            var yogaB = treeMgr.GetYogaNode(childB);

            Assert.AreEqual(0f, yogaA.LayoutX, 0.1f);
            Assert.AreEqual(0f, yogaA.LayoutY, 0.1f);
            Assert.AreEqual(300f, yogaA.LayoutWidth, 0.1f);
            Assert.AreEqual(150f, yogaA.LayoutHeight, 0.1f);

            Assert.AreEqual(0f, yogaB.LayoutX, 0.1f);
            Assert.AreEqual(150f, yogaB.LayoutY, 0.1f);
            Assert.AreEqual(300f, yogaB.LayoutWidth, 0.1f);
            Assert.AreEqual(150f, yogaB.LayoutHeight, 0.1f);
        }

        /// <summary>
        /// Margin: row layout, child A has margin-left=20px.
        /// Expected: child A offset by 20px from left.
        /// </summary>
        [Test]
        public void ComputeLayout_ChildWithMargin_OffsetsPosition()
        {
            // Arrange
            var root = _dom.Root;
            root.InlineStyles["flex-direction"] = "row";

            var childA = _dom.CreateElement(NodeTag.Div);
            childA.InlineStyles["width"] = "100px";
            childA.InlineStyles["height"] = "100px";
            childA.InlineStyles["margin-left"] = "20px";
            _dom.AppendChild(root, childA);

            var dirtyNodes = new List<VirtualNode> { root, childA };
            var engine = new YogaLayoutEngine(_dom, 800f, 600f);
            var treeMgr = new YogaTreeManager();

            // Act
            engine.ComputeLayout(dirtyNodes);

            // Assert
            treeMgr.SyncTree(root);
            var yogaA = treeMgr.GetYogaNode(childA);
            Assert.AreEqual(20f, yogaA.LayoutX, 0.1f);
            Assert.AreEqual(100f, yogaA.LayoutWidth, 0.1f);
            Assert.AreEqual(100f, yogaA.LayoutHeight, 0.1f);
        }

        /// <summary>
        /// Padding: column layout, root has padding=10px, child 100x50.
        /// Expected: child offset by padding (10, 10).
        /// </summary>
        [Test]
        public void ComputeLayout_RootWithPadding_OffsetsChildren()
        {
            // Arrange
            var root = _dom.Root;
            root.InlineStyles["flex-direction"] = "column";
            root.InlineStyles["padding"] = "10px";

            var child = _dom.CreateElement(NodeTag.Div);
            child.InlineStyles["width"] = "100px";
            child.InlineStyles["height"] = "50px";
            _dom.AppendChild(root, child);

            var dirtyNodes = new List<VirtualNode> { root, child };
            var engine = new YogaLayoutEngine(_dom, 800f, 600f);
            var treeMgr = new YogaTreeManager();

            // Act
            engine.ComputeLayout(dirtyNodes);

            // Assert — child should be offset by padding
            treeMgr.SyncTree(root);
            var yogaChild = treeMgr.GetYogaNode(child);
            Assert.AreEqual(10f, yogaChild.LayoutX, 0.1f);
            Assert.AreEqual(10f, yogaChild.LayoutY, 0.1f);
            Assert.AreEqual(100f, yogaChild.LayoutWidth, 0.1f);
            Assert.AreEqual(50f, yogaChild.LayoutHeight, 0.1f);
        }

        /// <summary>
        /// Three-level tree: root → container (row, 400x200) → two items (150x100 each).
        /// Verifies nested layout computation.
        /// </summary>
        [Test]
        public void ComputeLayout_NestedTree_ComputesCorrectPositions()
        {
            // Arrange
            var root = _dom.Root;
            root.InlineStyles["flex-direction"] = "column";

            var container = _dom.CreateElement(NodeTag.Div);
            container.InlineStyles["flex-direction"] = "row";
            container.InlineStyles["width"] = "400px";
            container.InlineStyles["height"] = "200px";
            _dom.AppendChild(root, container);

            var itemA = _dom.CreateElement(NodeTag.Div);
            itemA.InlineStyles["width"] = "150px";
            itemA.InlineStyles["height"] = "100px";
            _dom.AppendChild(container, itemA);

            var itemB = _dom.CreateElement(NodeTag.Div);
            itemB.InlineStyles["width"] = "150px";
            itemB.InlineStyles["height"] = "100px";
            _dom.AppendChild(container, itemB);

            var dirtyNodes = new List<VirtualNode> { root, container, itemA, itemB };
            var engine = new YogaLayoutEngine(_dom, 800f, 600f);
            var treeMgr = new YogaTreeManager();

            // Act
            engine.ComputeLayout(dirtyNodes);

            // Assert — verify Yoga computed layout values
            treeMgr.SyncTree(root);
            var yogaContainer = treeMgr.GetYogaNode(container);
            Assert.AreEqual(0f, yogaContainer.LayoutX, 0.1f);
            Assert.AreEqual(0f, yogaContainer.LayoutY, 0.1f);
            Assert.AreEqual(400f, yogaContainer.LayoutWidth, 0.1f);
            Assert.AreEqual(200f, yogaContainer.LayoutHeight, 0.1f);

            var yogaA = treeMgr.GetYogaNode(itemA);
            var yogaB = treeMgr.GetYogaNode(itemB);

            Assert.AreEqual(0f, yogaA.LayoutX, 0.1f);
            Assert.AreEqual(0f, yogaA.LayoutY, 0.1f);
            Assert.AreEqual(150f, yogaA.LayoutWidth, 0.1f);
            Assert.AreEqual(100f, yogaA.LayoutHeight, 0.1f);

            Assert.AreEqual(150f, yogaB.LayoutX, 0.1f);
            Assert.AreEqual(0f, yogaB.LayoutY, 0.1f);
            Assert.AreEqual(150f, yogaB.LayoutWidth, 0.1f);
            Assert.AreEqual(100f, yogaB.LayoutHeight, 0.1f);
        }

        /// <summary>
        /// Empty dirty list — ComputeLayout should be a no-op without errors.
        /// </summary>
        [Test]
        public void ComputeLayout_EmptyDirtyList_DoesNotThrow()
        {
            var engine = new YogaLayoutEngine(_dom, 800f, 600f);
            Assert.DoesNotThrow(() => engine.ComputeLayout(new List<VirtualNode>()));
        }
    }
}
