import SLODial from "./SLODial";
import { getBurnRateStatus, getStatusMessage } from "../lib/sloMath";

interface BurnRates {
  "1h": number;
  "6h": number;
  "24h": number;
  "3d": number;
}

interface ExperienceHeaderProps {
  name: string;
  compliancePercent: number; // % of SLOs in compliance
  burnRates: BurnRates;
}

export default function ExperienceHeader({ name, compliancePercent, burnRates }: ExperienceHeaderProps) {
  // Determine overall status based on worst burn rate
  const maxBurnRate = Math.max(burnRates["1h"], burnRates["6h"], burnRates["24h"], burnRates["3d"]);
  const status = getBurnRateStatus(maxBurnRate);
  const statusMessage = getStatusMessage(status);

  const getBadgeColor = (rate: number) => {
    const st = getBurnRateStatus(rate);
    if (st === "ok") return "bg-green-100 text-green-800";
    if (st === "warn") return "bg-amber-100 text-amber-800";
    return "bg-red-100 text-red-800";
  };

  const getBannerColor = () => {
    if (status === "ok") return "bg-green-50 border-green-200";
    if (status === "warn") return "bg-amber-50 border-amber-200";
    return "bg-red-50 border-red-200";
  };

  const getStatusColor = () => {
    if (status === "ok") return "text-green-700";
    if (status === "warn") return "text-amber-700";
    return "text-red-700";
  };

  return (
    <div className={`rounded-2xl border-2 p-6 ${getBannerColor()} shadow-sm mb-6`}>
      <div className="flex items-start justify-between gap-6">
        {/* Left: Title and dial */}
        <div className="flex items-center gap-6">
          <SLODial value={compliancePercent} size={140} label="SLOs in Compliance" />
          <div>
            <h1 className="text-3xl font-bold text-neutral-900 mb-2">{name}</h1>
            <p className={`text-xl font-semibold ${getStatusColor()}`}>
              {statusMessage}
            </p>
          </div>
        </div>

        {/* Right: Burn rate badges */}
        <div className="flex flex-col gap-2">
          <div className="text-sm font-medium text-neutral-700 mb-1">Burn Rate Windows</div>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(burnRates) as Array<keyof BurnRates>).map(window => (
              <div
                key={window}
                className={`px-3 py-2 rounded-lg ${getBadgeColor(burnRates[window])}`}
              >
                <div className="text-xs font-medium opacity-75">{window}</div>
                <div className="text-lg font-bold">{burnRates[window].toFixed(2)}x</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
