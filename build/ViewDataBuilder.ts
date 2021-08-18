import feather from "feather-icons";
import npmConfig from "../package.json";

export default class ViewDataBuilder {
  private static readonly LBL_CLOSE: string = "Close";
  private static readonly ICON_INFO: string = feather.icons["info"].toSvg();

  public BuildViewData(): Promise<unknown> {
    return Promise.resolve({
      title: "Git 3D",
      alerts: [
        {
          level: "danger",
          icon: feather.icons["alert-octagon"].toSvg({
            "aria-label": "Danger:",
          }),
          message: "Everything's broken!",
          closeBtnLbl: ViewDataBuilder.LBL_CLOSE,
        },
        {
          level: "warning",
          icon: feather.icons["alert-triangle"].toSvg({
            "aria-label": "Warning:",
          }),
          message: "Everything is probably broken",
          closeBtnLbl: ViewDataBuilder.LBL_CLOSE,
        },
        {
          level: "info",
          icon: ViewDataBuilder.ICON_INFO,
          message: "Everything should be fine",
          closeBtnLbl: ViewDataBuilder.LBL_CLOSE,
        },
      ],
      navbar: {
        mainHeading: "Git 3D",
        toggleBtnLbl: "Toggle navigation",
        externalLinkIcon: feather.icons["external-link"].toSvg(),
        links: [
          {
            icon: ViewDataBuilder.ICON_INFO,
            label: "About",
            href: "#",
            external: false,
          },
          {
            icon: feather.icons["dollar-sign"].toSvg(),
            label: "Support",
            href: npmConfig.funding.url,
            external: true,
          },
          {
            icon: feather.icons["code"].toSvg(),
            label: "Source",
            href: npmConfig.repository.url,
            external: true,
          },
        ],
        optionsMenuBtnLbl: "Toggle options menu",
        optionsMenuBtnIcon: feather.icons["menu"].toSvg(),
      },
      optionsMenu: {
        description:
          "This is some placeholder content for a horizontal collapse. It's hidden by default and shown when triggered.",
      },
      footer: {
        copyright: `Copyright © ${npmConfig.author.name}`,
      },
    });
  }
}
