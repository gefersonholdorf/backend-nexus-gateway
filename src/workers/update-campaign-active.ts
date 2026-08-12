import { prisma } from "@/db/prisma";
import cron from "node-cron";

export function startUpdatedCampaignActiveWorker() {
    cron.schedule("*/1 * * * *", async () => {
        console.log(
            "[UPDATED CAMPAIGN ACTIVE] Iniciando processo",
            new Date()
        );

        try {
            const currentDate = new Date();

            const currentMonth = currentDate.getMonth() + 1;
            const currentYear = currentDate.getFullYear();

            const monthYear = `${currentYear}-${String(currentMonth).padStart(2, "0")}`;

            const campaignScheduled =
                await prisma.campaigns.findFirst({
                    where: {
                        st_status: "SCHEDULED",
                        ds_month_year: monthYear,
                        dt_publication: {
                            lte: currentDate,
                        },
                    },
                    orderBy: {
                        dt_publication: "asc",
                    },
                });

            if (!campaignScheduled) {
                console.log(
                    "[UPDATED CAMPAIGN ACTIVE] Nenhuma campanha elegível para publicação."
                );

                return;
            }

            await prisma.$transaction(async (tx) => {
                await tx.campaigns.updateMany({
                    where: {
                        st_status: "PUBLISHED",
                        cd_campaign: {
                            not: campaignScheduled.cd_campaign,
                        },
                    },
                    data: {
                        st_status: "INACTIVE",
                    },
                });
                await tx.campaigns.update({
                    where: {
                        cd_campaign: campaignScheduled.cd_campaign,
                    },
                    data: {
                        st_status: "PUBLISHED",
                    },
                });
            });

            console.log(
                `[UPDATED CAMPAIGN ACTIVE] Campanha ${campaignScheduled.cd_campaign} publicada com sucesso.`
            );
        } catch (error) {
            console.error(
                "[UPDATED CAMPAIGN ACTIVE] Erro",
                error
            );
        }
    });
}