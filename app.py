import heapq
from typing import Dict, List, Tuple

import matplotlib.pyplot as plt
import networkx as nx
import streamlit as st


Graph = Dict[str, Dict[str, int]]


LOCATION_LABELS = {
    "A": "Ambulance Base",
    "B": "Central Junction",
    "C": "Market Road",
    "D": "Fire Station",
    "E": "School Zone",
    "F": "City Bridge",
    "G": "Residential Block",
    "H": "General Hospital",
}


LOCATION_TYPES = {
    "A": "ambulance",
    "H": "hospital",
    "B": "junction",
    "C": "road",
    "D": "station",
    "E": "zone",
    "F": "bridge",
    "G": "residential",
}


POSITIONS = {
    "A": (0, 2),
    "B": (1.4, 3.2),
    "C": (2.9, 2.1),
    "D": (1.6, 0.9),
    "E": (3.6, 3.6),
    "F": (4.8, 2.0),
    "G": (3.0, 0.4),
    "H": (6.1, 2.4),
}


def create_graph() -> Graph:
    """Create a sample weighted city road graph using an adjacency list."""
    return {
        "A": {"B": 6, "D": 8},
        "B": {"A": 6, "C": 5, "E": 7, "D": 2},
        "C": {"B": 5, "E": 3, "F": 6, "G": 4},
        "D": {"A": 8, "B": 2, "G": 7},
        "E": {"B": 7, "C": 3, "F": 4},
        "F": {"C": 6, "E": 4, "H": 5, "G": 3},
        "G": {"D": 7, "C": 4, "F": 3, "H": 6},
        "H": {"F": 5, "G": 6},
    }


def dijkstra(graph: Graph, source: str, destination: str) -> Tuple[int, List[str]]:
    """Find the shortest distance and path between two nodes."""
    distances = {node: float("inf") for node in graph}
    previous = {node: None for node in graph}
    distances[source] = 0
    priority_queue = [(0, source)]

    while priority_queue:
        current_distance, current_node = heapq.heappop(priority_queue)

        if current_node == destination:
            break

        if current_distance > distances[current_node]:
            continue

        for neighbor, weight in graph[current_node].items():
            distance = current_distance + weight
            if distance < distances[neighbor]:
                distances[neighbor] = distance
                previous[neighbor] = current_node
                heapq.heappush(priority_queue, (distance, neighbor))

    if distances[destination] == float("inf"):
        return -1, []

    path = []
    current = destination
    while current is not None:
        path.append(current)
        current = previous[current]
    path.reverse()

    return int(distances[destination]), path


def edge_key(node_a: str, node_b: str) -> Tuple[str, str]:
    """Return a stable key for an undirected road edge."""
    return tuple(sorted((node_a, node_b)))


def apply_weight_overrides(graph: Graph, overrides: Dict[Tuple[str, str], int]) -> Graph:
    """Apply traffic-adjusted road weights to both directions of each road."""
    updated_graph = {node: neighbors.copy() for node, neighbors in graph.items()}
    for (node_a, node_b), weight in overrides.items():
        if node_b in updated_graph[node_a] and node_a in updated_graph[node_b]:
            updated_graph[node_a][node_b] = weight
            updated_graph[node_b][node_a] = weight
    return updated_graph


def get_unique_edges(graph: Graph) -> List[Tuple[str, str, int]]:
    """Return undirected edges once, sorted by location code."""
    edges = []
    seen = set()
    for node, neighbors in graph.items():
        for neighbor, weight in neighbors.items():
            key = edge_key(node, neighbor)
            if key not in seen:
                edges.append((key[0], key[1], weight))
                seen.add(key)
    return sorted(edges)


def location_name(node: str) -> str:
    return f"{node}: {LOCATION_LABELS[node]}"


def format_path(path: List[str]) -> str:
    return " → ".join(path)


def visualize_graph(graph: Graph, shortest_path: List[str] | None = None):
    """Render the road network and highlight the selected fastest route."""
    shortest_path = shortest_path or []
    network = nx.Graph()

    for node, neighbors in graph.items():
        network.add_node(node)
        for neighbor, weight in neighbors.items():
            network.add_edge(node, neighbor, weight=weight)

    path_edges = set()
    for index in range(len(shortest_path) - 1):
        path_edges.add(edge_key(shortest_path[index], shortest_path[index + 1]))

    node_colors = []
    for node in network.nodes:
        if node in shortest_path:
            node_colors.append("#ef4444")
        elif LOCATION_TYPES[node] == "hospital":
            node_colors.append("#14b8a6")
        elif LOCATION_TYPES[node] == "ambulance":
            node_colors.append("#2563eb")
        else:
            node_colors.append("#e2e8f0")

    edge_colors = [
        "#ef4444" if edge_key(node_a, node_b) in path_edges else "#94a3b8"
        for node_a, node_b in network.edges
    ]
    edge_widths = [
        4 if edge_key(node_a, node_b) in path_edges else 2
        for node_a, node_b in network.edges
    ]

    fig, ax = plt.subplots(figsize=(10, 5.8))
    fig.patch.set_facecolor("#f8fafc")
    ax.set_facecolor("#f8fafc")

    nx.draw_networkx_edges(
        network,
        POSITIONS,
        ax=ax,
        edge_color=edge_colors,
        width=edge_widths,
        alpha=0.95,
    )
    nx.draw_networkx_nodes(
        network,
        POSITIONS,
        ax=ax,
        node_color=node_colors,
        node_size=1800,
        edgecolors="#0f172a",
        linewidths=1.5,
    )
    nx.draw_networkx_labels(
        network,
        POSITIONS,
        ax=ax,
        labels={node: node for node in network.nodes},
        font_size=13,
        font_weight="bold",
        font_color="#0f172a",
    )

    edge_labels = nx.get_edge_attributes(network, "weight")
    nx.draw_networkx_edge_labels(
        network,
        POSITIONS,
        ax=ax,
        edge_labels=edge_labels,
        font_size=10,
        font_color="#334155",
        bbox={"boxstyle": "round,pad=0.25", "fc": "#ffffff", "ec": "#cbd5e1"},
    )

    ax.set_title("Live City Road Network", fontsize=16, fontweight="bold", color="#0f172a")
    ax.margins(0.15)
    ax.axis("off")
    plt.tight_layout()
    return fig


def render_status_cards(graph: Graph):
    edges = get_unique_edges(graph)
    avg_time = sum(weight for _, _, weight in edges) / len(edges)

    card_one, card_two, card_three, card_four = st.columns(4)
    card_one.metric("Active locations", len(graph))
    card_two.metric("Monitored roads", len(edges))
    card_three.metric("Avg. traffic time", f"{avg_time:.1f} min")
    card_four.metric("Emergency units", "3 online")


def render_traffic_controls(base_graph: Graph) -> Dict[Tuple[str, str], int]:
    st.sidebar.subheader("Traffic Simulator")
    st.sidebar.caption("Adjust road travel time to simulate congestion, closures, or green corridors.")

    overrides = {}
    for node_a, node_b, weight in get_unique_edges(base_graph):
        label = f"{node_a}-{node_b} ({LOCATION_LABELS[node_a]} to {LOCATION_LABELS[node_b]})"
        overrides[(node_a, node_b)] = st.sidebar.slider(
            label,
            min_value=1,
            max_value=25,
            value=weight,
            step=1,
            help="Estimated travel time in minutes.",
        )
    return overrides


def main():
    st.set_page_config(
        page_title="Emergency Route Optimization System",
        page_icon="🚑",
        layout="wide",
    )

    st.markdown(
        """
        <style>
            .block-container {
                padding-top: 2rem;
                padding-bottom: 2rem;
            }
            [data-testid="stMetric"] {
                background: #ffffff;
                border: 1px solid #dbe3ef;
                border-radius: 8px;
                padding: 16px;
                box-shadow: 0 8px 22px rgba(15, 23, 42, 0.06);
            }
            .route-panel {
                background: #ffffff;
                border: 1px solid #dbe3ef;
                border-radius: 8px;
                padding: 18px 20px;
                margin-top: 12px;
            }
            .route-label {
                color: #475569;
                font-size: 0.9rem;
                margin-bottom: 0.2rem;
            }
            .route-path {
                color: #dc2626;
                font-size: 1.65rem;
                font-weight: 800;
                line-height: 1.35;
            }
            .location-list {
                background: #f8fafc;
                border-left: 4px solid #ef4444;
                padding: 12px 16px;
                border-radius: 6px;
            }
        </style>
        """,
        unsafe_allow_html=True,
    )

    base_graph = create_graph()

    st.title("Emergency Route Optimization System")
    st.caption("Smart Emergency Route Optimization System powered by Dijkstra's Algorithm")

    st.sidebar.header("Dispatch Controls")
    source = st.sidebar.selectbox(
        "Select Source (Ambulance location)",
        options=list(base_graph.keys()),
        format_func=location_name,
        index=0,
    )
    destination = st.sidebar.selectbox(
        "Select Destination (Hospital)",
        options=list(base_graph.keys()),
        format_func=location_name,
        index=list(base_graph.keys()).index("H"),
    )

    traffic_overrides = render_traffic_controls(base_graph)
    graph = apply_weight_overrides(base_graph, traffic_overrides)

    render_status_cards(graph)

    left_panel, right_panel = st.columns([1, 1.4], gap="large")

    with left_panel:
        st.subheader("Emergency Dispatch")
        st.info(
            f"Ambulance ready at **{location_name(source)}**. "
            f"Destination set to **{location_name(destination)}**."
        )

        st.markdown(
            """
            <div class="location-list">
                <strong>City nodes</strong><br>
                A: Ambulance Base<br>
                B: Central Junction<br>
                C: Market Road<br>
                D: Fire Station<br>
                E: School Zone<br>
                F: City Bridge<br>
                G: Residential Block<br>
                H: General Hospital
            </div>
            """,
            unsafe_allow_html=True,
        )

        find_route = st.button("Find Fastest Route", type="primary", use_container_width=True)

        if source == destination:
            st.warning("Source and destination are the same. Select a different destination.")
            shortest_distance, shortest_path = 0, [source]
        elif find_route:
            with st.spinner("Scanning traffic and computing fastest emergency route..."):
                time.sleep(0.8)
                shortest_distance, shortest_path = dijkstra(graph, source, destination)

            if shortest_path:
                st.success("Fastest emergency route found.")
                st.metric("Total estimated travel time", f"{shortest_distance} min")
                st.markdown(
                    f"""
                    <div class="route-panel">
                        <div class="route-label">Recommended route</div>
                        <div class="route-path">{format_path(shortest_path)}</div>
                    </div>
                    """,
                    unsafe_allow_html=True,
                )
            else:
                st.error("No available route found with the current road network.")
        else:
            shortest_path = []
            st.info("Adjust traffic conditions, then click **Find Fastest Route**.")

    with right_panel:
        st.subheader("Route Map")
        fig = visualize_graph(graph, shortest_path)
        st.pyplot(fig, use_container_width=True)
        plt.close(fig)

    with st.expander("Current road travel times"):
        road_rows = [
            {
                "Road": f"{node_a} -> {node_b}",
                "From": LOCATION_LABELS[node_a],
                "To": LOCATION_LABELS[node_b],
                "Travel Time (min)": weight,
            }
            for node_a, node_b, weight in get_unique_edges(graph)
        ]
        st.dataframe(road_rows, use_container_width=True, hide_index=True)


LOCATIONS = {
    "Anna Nagar": "Residential and commercial hub",
    "T Nagar": "Shopping district",
    "Guindy": "Industrial corridor",
    "Airport": "Chennai International Airport",
    "Velachery": "IT and residential zone",
    "Adyar": "Education and river corridor",
    "Marina Beach": "Coastal arterial area",
    "Central Station": "Railway transit hub",
}


POSITIONS = {
    "Anna Nagar": (0.5, 4.2),
    "Central Station": (2.0, 5.2),
    "T Nagar": (2.5, 3.2),
    "Guindy": (4.1, 2.4),
    "Airport": (6.2, 1.4),
    "Velachery": (5.2, 3.6),
    "Adyar": (4.3, 5.0),
    "Marina Beach": (6.1, 5.7),
}


def create_graph() -> Graph:
    """Create an offline weighted city road map using an adjacency list."""
    return {
        "Anna Nagar": {"Central Station": 16, "T Nagar": 18},
        "Central Station": {"Anna Nagar": 16, "T Nagar": 14, "Marina Beach": 12},
        "T Nagar": {
            "Anna Nagar": 18,
            "Central Station": 14,
            "Guindy": 11,
            "Adyar": 19,
        },
        "Guindy": {"T Nagar": 11, "Airport": 13, "Velachery": 9},
        "Airport": {"Guindy": 13, "Velachery": 16},
        "Velachery": {"Guindy": 9, "Airport": 16, "Adyar": 12},
        "Adyar": {"T Nagar": 19, "Velachery": 12, "Marina Beach": 10},
        "Marina Beach": {"Central Station": 12, "Adyar": 10},
    }


def dijkstra(graph: Graph, source: str, destination: str) -> Tuple[int, List[str]]:
    """Compute the shortest path from source to destination from scratch."""
    distances = {node: float("inf") for node in graph}
    previous_nodes = {node: None for node in graph}
    distances[source] = 0
    priority_queue = [(0, source)]

    while priority_queue:
        current_distance, current_node = heapq.heappop(priority_queue)

        if current_node == destination:
            break

        if current_distance > distances[current_node]:
            continue

        for neighbor, weight in graph[current_node].items():
            candidate_distance = current_distance + weight
            if candidate_distance < distances[neighbor]:
                distances[neighbor] = candidate_distance
                previous_nodes[neighbor] = current_node
                heapq.heappush(priority_queue, (candidate_distance, neighbor))

    if distances[destination] == float("inf"):
        return -1, []

    path = []
    current_node = destination
    while current_node is not None:
        path.append(current_node)
        current_node = previous_nodes[current_node]

    return int(distances[destination]), list(reversed(path))


def format_path(path: List[str]) -> str:
    return " -> ".join(path)


def apply_traffic_weights(graph: Graph, weights: Dict[Tuple[str, str], int]) -> Graph:
    """Apply slider-controlled travel times to both directions of each road."""
    updated_graph = {node: neighbors.copy() for node, neighbors in graph.items()}

    for (node_a, node_b), travel_time in weights.items():
        updated_graph[node_a][node_b] = travel_time
        updated_graph[node_b][node_a] = travel_time

    return updated_graph


def visualize_graph(graph: Graph, shortest_path: List[str]):
    """Draw the current road network and highlight the shortest path."""
    city_map = nx.Graph()

    for node, neighbors in graph.items():
        city_map.add_node(node)
        for neighbor, weight in neighbors.items():
            city_map.add_edge(node, neighbor, weight=weight)

    shortest_edges = {
        edge_key(shortest_path[index], shortest_path[index + 1])
        for index in range(len(shortest_path) - 1)
    }

    node_colors = [
        "#35d07f" if node in shortest_path else "#63d6e8"
        for node in city_map.nodes
    ]
    edge_colors = [
        "#ffb000" if edge_key(node_a, node_b) in shortest_edges else "#6f7a80"
        for node_a, node_b in city_map.edges
    ]
    edge_widths = [
        4.5 if edge_key(node_a, node_b) in shortest_edges else 2.2
        for node_a, node_b in city_map.edges
    ]

    fig, ax = plt.subplots(figsize=(11, 6.4))
    fig.patch.set_facecolor("#111315")
    ax.set_facecolor("#111315")

    nx.draw_networkx_edges(
        city_map,
        POSITIONS,
        ax=ax,
        edge_color=edge_colors,
        width=edge_widths,
        alpha=0.95,
    )
    nx.draw_networkx_nodes(
        city_map,
        POSITIONS,
        ax=ax,
        node_color=node_colors,
        node_size=2100,
        edgecolors="#f2f4f3",
        linewidths=1.4,
    )
    nx.draw_networkx_labels(
        city_map,
        POSITIONS,
        ax=ax,
        font_size=9,
        font_weight="bold",
        font_color="#080a0b",
    )
    nx.draw_networkx_edge_labels(
        city_map,
        POSITIONS,
        ax=ax,
        edge_labels=nx.get_edge_attributes(city_map, "weight"),
        font_size=9,
        font_color="#f6f7f5",
        bbox={"boxstyle": "round,pad=0.25", "fc": "#202427", "ec": "#3b4246"},
    )

    ax.set_title("Live Traffic Network", fontsize=16, fontweight="bold", color="#f6f7f5")
    ax.margins(0.12)
    ax.axis("off")
    plt.tight_layout()
    return fig


def render_traffic_controls(base_graph: Graph) -> Dict[Tuple[str, str], int]:
    st.sidebar.subheader("Traffic congestion")
    st.sidebar.caption("Increase travel time to simulate traffic build-up on a road.")

    weights = {}
    for node_a, node_b, default_time in get_unique_edges(base_graph):
        weights[(node_a, node_b)] = st.sidebar.slider(
            f"{node_a} to {node_b}",
            min_value=3,
            max_value=45,
            value=default_time,
            step=1,
            help="Travel time in minutes",
        )

    return weights


def render_dashboard_metrics(graph: Graph, shortest_distance: int, shortest_path: List[str]):
    edges = get_unique_edges(graph)
    average_time = sum(weight for _, _, weight in edges) / len(edges)

    metric_one, metric_two, metric_three, metric_four = st.columns(4)
    metric_one.metric("Locations", len(graph))
    metric_two.metric("Road segments", len(edges))
    metric_three.metric("Average road time", f"{average_time:.1f} min")
    metric_four.metric("Fastest route time", f"{shortest_distance} min")

    st.markdown(
        f"""
        <div class="route-card">
            <div class="eyebrow">Recommended route</div>
            <div class="route-path">{format_path(shortest_path)}</div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def main():
    st.set_page_config(
        page_title="City Traffic Route Optimization System",
        page_icon=":material/route:",
        layout="wide",
    )

    st.markdown(
        """
        <style>
            .stApp {
                background:
                    linear-gradient(135deg, rgba(17, 19, 21, 0.99), rgba(26, 29, 31, 0.98)),
                    #111315;
                color: #f6f7f5;
            }
            section[data-testid="stSidebar"] {
                background: #171a1c;
                border-right: 1px solid #3b4246;
            }
            .block-container {
                padding-top: 2rem;
                padding-bottom: 2rem;
            }
            h1, h2, h3, p, label, span {
                color: #f6f7f5;
            }
            [data-testid="stMetric"] {
                background: #1f2326;
                border: 1px solid #3b4246;
                border-radius: 8px;
                padding: 16px;
                box-shadow: 0 12px 28px rgba(0, 0, 0, 0.28);
            }
            [data-testid="stMetricLabel"], [data-testid="stMetricValue"] {
                color: #f6f7f5;
            }
            .route-card {
                background: #1f2326;
                border: 1px solid #3b4246;
                border-radius: 8px;
                padding: 20px;
                margin: 18px 0;
            }
            .eyebrow {
                color: #63d6e8;
                font-size: 0.9rem;
                font-weight: 700;
                letter-spacing: 0;
                text-transform: uppercase;
                margin-bottom: 8px;
            }
            .route-path {
                color: #ffb000;
                font-size: 1.55rem;
                font-weight: 800;
                line-height: 1.35;
            }
            .algorithm-box {
                background: #080a0b;
                border-left: 4px solid #35d07f;
                border-radius: 8px;
                padding: 14px 16px;
                color: #d8ddd9;
                margin-top: 8px;
            }
            div[data-testid="stDataFrame"] {
                border: 1px solid #3b4246;
                border-radius: 8px;
            }
        </style>
        """,
        unsafe_allow_html=True,
    )

    base_graph = create_graph()

    st.title("City Traffic Route Optimization System")
    st.caption("Offline navigation dashboard using Dijkstra's Algorithm and live traffic weights")

    st.sidebar.header("Route controls")
    source = st.sidebar.selectbox(
        "Source location",
        options=list(base_graph.keys()),
        index=list(base_graph.keys()).index("Anna Nagar"),
    )
    destination = st.sidebar.selectbox(
        "Destination location",
        options=list(base_graph.keys()),
        index=list(base_graph.keys()).index("Airport"),
    )

    traffic_weights = render_traffic_controls(base_graph)
    graph = apply_traffic_weights(base_graph, traffic_weights)

    if source == destination:
        shortest_distance, shortest_path = 0, [source]
    else:
        shortest_distance, shortest_path = dijkstra(graph, source, destination)

    result_panel, map_panel = st.columns([1, 1.35], gap="large")

    with result_panel:
        st.subheader("Navigation result")
        if source == destination:
            st.info("Source and destination are the same. Travel time is 0 minutes.")
        elif shortest_path:
            st.success("Shortest route updated from current traffic conditions.")
        else:
            st.error("No route is available for the selected locations.")

        if shortest_path:
            render_dashboard_metrics(graph, shortest_distance, shortest_path)

        st.subheader("How Dijkstra is used")
        st.markdown(
            """
            <div class="algorithm-box">
                The app stores the city as an adjacency list. Every slider changes an edge weight,
                then Dijkstra's Algorithm recalculates the lowest total travel time from the selected
                source to the selected destination.
            </div>
            """,
            unsafe_allow_html=True,
        )

        with st.expander("Current road weights"):
            road_rows = [
                {
                    "Road": f"{node_a} to {node_b}",
                    "Travel Time (min)": weight,
                }
                for node_a, node_b, weight in get_unique_edges(graph)
            ]
            st.dataframe(road_rows, use_container_width=True, hide_index=True)

    with map_panel:
        st.subheader("City map")
        fig = visualize_graph(graph, shortest_path)
        st.pyplot(fig, use_container_width=True)
        plt.close(fig)

        st.subheader("Locations")
        location_rows = [
            {"Location": location, "Type": description}
            for location, description in LOCATIONS.items()
        ]
        st.dataframe(location_rows, use_container_width=True, hide_index=True)


if __name__ == "__main__":
    main()
