import feather from "feather-icons";
import npmConfig from "../package.json";

export default class ViewDataBuilder {
  private static readonly LBL_CLOSE: string = "Close";

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
          icon: feather.icons["info"].toSvg(),
          message: "Everything should be fine",
          closeBtnLbl: ViewDataBuilder.LBL_CLOSE,
        },
      ],
      navbar: {
        mainHeading: "Git 3D",
        toggleBtnLbl: "Toggle navigation",
        aboutBtnLbl: "About",
        supportBtnLbl: "Support",
        sourceBtnLbl: "Source",
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
