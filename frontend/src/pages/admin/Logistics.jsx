import { useEffect, useState } from "react";
import PageHeader from "../../components/PageHeader.jsx";
import Panel from "../../components/Panel.jsx";
import DataTable from "../../components/DataTable.jsx";
import StatusPill from "../../components/StatusPill.jsx";
import { getShipments } from "../../services/api/orders.js";

export default function AdminLogistics() {
  const [shipments, setShipments] = useState([]);

  useEffect(() => {
    getShipments().then(setShipments);
  }, []);

  return (
    <>
      <PageHeader title="Logistics" subtitle="Where every shipment is, right now." />
      <Panel>
        <DataTable
          columns={[
            { label: "Shipment", key: "id" },
            { label: "Order", key: "orderId" },
            { label: "Carrier", key: "carrier" },
            { label: "Route", render: (s) => `${s.origin} to ${s.destination}` },
            { label: "Stage", render: (s) => <StatusPill status={s.stage} /> },
            { label: "Expected by", key: "eta" },
          ]}
          rows={shipments}
        />
      </Panel>
    </>
  );
}
