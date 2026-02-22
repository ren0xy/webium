using System.Collections.Generic;
using NUnit.Framework;
using UnityEngine;
using Webium.Core;
using Webium.Unity;

namespace Webium.Tests.Unity.Runtime.Layout
{
    /// <summary>
    /// Unit tests for UGUILayoutBridge readback.
    /// Requirements: 7.1, 7.2
    /// </summary>
    [TestFixture]
    public class UGUILayoutBridgeTests
    {
        private readonly List<GameObject> _gameObjects = new List<GameObject>();

        [TearDown]
        public void TearDown()
        {
            foreach (var go in _gameObjects)
                Object.DestroyImmediate(go);
            _gameObjects.Clear();
        }

        private GameObject CreateTrackedGameObject(string name)
        {
            var go = new GameObject(name);
            _gameObjects.Add(go);
            return go;
        }

        [Test]
        public void Readback_KnownValues_ReturnsCorrectXYWidthHeight()
        {
            // Arrange: create a GameObject with RectTransform set to known Yoga-mapped values
            var go = CreateTrackedGameObject("Node1");
            var rt = go.AddComponent<RectTransform>();
            rt.anchorMin = new Vector2(0f, 1f);
            rt.anchorMax = new Vector2(0f, 1f);
            rt.pivot = new Vector2(0f, 1f);
            rt.anchoredPosition = new Vector2(30f, -20f); // Yoga x=30, y=20
            rt.sizeDelta = new Vector2(200f, 150f);       // Yoga w=200, h=150

            var canvasGo = CreateTrackedGameObject("Canvas");
            var canvasRt = canvasGo.AddComponent<RectTransform>();

            var nodeObjects = new Dictionary<int, GameObject> { { 1, go } };
            var bridge = new UGUILayoutBridge(canvasRt, nodeObjects);

            // Act & Assert
            Assert.AreEqual(30f, bridge.GetX(1), "GetX should return anchoredPosition.x");
            Assert.AreEqual(20f, bridge.GetY(1), "GetY should return -anchoredPosition.y");
            Assert.AreEqual(200f, bridge.GetWidth(1), "GetWidth should return sizeDelta.x");
            Assert.AreEqual(150f, bridge.GetHeight(1), "GetHeight should return sizeDelta.y");
        }

        [Test]
        public void Readback_NonexistentNodeId_ReturnsZero()
        {
            // Arrange: empty dictionary — no nodes registered
            var canvasGo = CreateTrackedGameObject("Canvas");
            var canvasRt = canvasGo.AddComponent<RectTransform>();

            var nodeObjects = new Dictionary<int, GameObject>();
            var bridge = new UGUILayoutBridge(canvasRt, nodeObjects);

            // Act & Assert
            Assert.AreEqual(0f, bridge.GetX(999), "GetX for missing nodeId should return 0");
            Assert.AreEqual(0f, bridge.GetY(999), "GetY for missing nodeId should return 0");
            Assert.AreEqual(0f, bridge.GetWidth(999), "GetWidth for missing nodeId should return 0");
            Assert.AreEqual(0f, bridge.GetHeight(999), "GetHeight for missing nodeId should return 0");
        }
    }
}
