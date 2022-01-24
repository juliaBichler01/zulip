import * as popovers from './popovers';
import * as user_status_ui from "./user_status_ui";
import render_mention_popover from "../templates/mention_popover.hbs";
import render_mention_popover_content from "../templates/mention_popover_content.hbs";
import render_mention_popover_user_list from "../templates/mention_popover_user_list.hbs";
import {initialize_compose_typeahead, get_person_suggestions} from './composebox_typeahead';
import { render_person } from './typeahead_helper';
import * as compose_ui from "./compose_ui";

// Mention picker is of fixed width and height. Update these
// whenever these values are changed in `reactions.css`.
const APPROX_HEIGHT = 375;
const APPROX_WIDTH = 400;

let current_message_mention_popover_elem;
let mention_catalog_last_coordinates = {
  section: 0,
  index: 0,
};
let edit_message_id = null;

const generate_mention_picker_content = function (id) {
  let persons = get_person_suggestions('', {});
  const first_person = persons[0].full_name;
  persons = persons.map((person) => {return {person: render_person(person), name: person.full_name}});

  return render_mention_popover_content({
      first: first_person,
      message_id: id,
      persons: persons,
  });
};

function filter_mentions() {
    const elt = $(".mention-popover-filter").expectOne();
    const query = elt.val().trim().toLowerCase();

    let persons = get_person_suggestions(query, {});
    const first_person = persons[0].full_name;
    persons = persons.map((person) => {return {person: render_person(person), name: person.full_name}});

    const user_list = render_mention_popover_user_list({
        first: first_person,
        persons: persons
    })

    $(".mention-popover-user-list").html(user_list);
    // $(".first_element").expectOne();
    registrer_click_handlers();
}

function process_keypress(e) {
    const is_filter_focused = $(".mention-popover-filter").is(":focus");
    const pressed_key = e.which;
    if (
        !is_filter_focused &&
        // ':' => 58, is a hotkey for toggling reactions popover.
        pressed_key !== 58 &&
        ((pressed_key >= 32 && pressed_key <= 126) || pressed_key === 8)
    ) {
        // Handle only printable characters or Backspace.
        e.preventDefault();
        e.stopPropagation();

        const mention_filter = $(".mention-popover-filter");
        const old_query = mention_filter.val();
        let new_query = "";

        if (pressed_key === 8) {
            // Handles Backspace.
            new_query = old_query.slice(0, -1);
        } else {
            // Handles any printable character.
            const key_str = String.fromCodePoint(e.which);
            new_query = old_query + key_str;
        }

        mention_filter.val(new_query);
        // change_focus_to_filter();
        filter_mentions();
    }
}

function process_enter_while_filtering(e) {
    if (e.key === "Enter") {
        e.preventDefault();
        const first_mention = $(".first_mention");
        $(first_mention).trigger("click");
    }
}

function reactions_popped() {
    return current_message_mention_popover_elem !== undefined;
}

function hide_mention_popover() {
    $(".has_popover").removeClass("has_popover has_emoji_popover");
    if (user_status_ui.user_status_picker_open()) {
        // Re-enable clicking events for other elements after closing
        // the popover.  This is the inverse of the hack of in the
        // handler that opens the "user status modal" emoji picker.
        $(".app, .header, .modal__overlay, #set_user_status_modal").css("pointer-events", "all");
    }
    if (reactions_popped()) {
        current_message_mention_popover_elem.popover("destroy");
        current_message_mention_popover_elem.removeClass("reaction_button_visible");
        current_message_mention_popover_elem = undefined;
    }
}

function register_popover_events() {
    const $user_list = $(".mention-popover-user-list");

    // ui.get_scroll_element($user_list).on("scroll", () => {
    //     emoji_select_tab(ui.get_scroll_element($user_list));
    // });

    registrer_click_handlers();

    $(".mention-popover-filter").on("input", filter_mentions);
    $(".mention-popover-filter").on("keydown", process_enter_while_filtering);
    $(".mention-popover").on("keypress", process_keypress);
    $(".mention-popover").on("keydown", (e) => {
        // Because of cross-browser issues we need to handle Backspace
        // key separately. Firefox fires `keypress` event for Backspace
        // key but chrome doesn't so we need to trigger the logic for
        // handling Backspace in `keydown` event which is fired by both.
        if (e.which === 8) {
            process_keypress(e);
        }
    });
}

function registrer_click_handlers() {
    $(".user_list_element").on("click", function (e) {
        $(this).hide();
        const mention_name = $(this).attr("name");
        const mention_text = "@**" + mention_name + "**";
        // The following check will return false if emoji was not selected in
        // message edit form.
        if (edit_message_id !== null) {
            const edit_message_textarea = $(
                `#edit_form_${CSS.escape(edit_message_id)} .message_edit_content`
            );
            // Assign null to edit_message_id so that the selection of emoji in new
            // message composition form works correctly.
            edit_message_id = null;
            compose_ui.insert_syntax_and_focus(mention_text, edit_message_textarea);
        } else {
            compose_ui.insert_syntax_and_focus(mention_text);
        }
        // e.stopPropagation();
        hide_mention_popover();
    });
}

function build_mention_popover(elt, id) {
  const template_args = {
      class: "mention-info-popover",
  };
  let placement = popovers.compute_placement(elt, APPROX_HEIGHT, APPROX_WIDTH, true);

  if (placement === "viewport_center") {
      // For legacy reasons `compute_placement` actually can
      // return `viewport_center`, but bootstrap doesn't actually
      // support that.
      placement = "left";
  }

  let template = render_mention_popover(template_args);

  // if the window is mobile sized, add the `.popover-flex` wrapper to the emoji
  // popover so that it will be wrapped in flex and centered in the screen.
  if (window.innerWidth <= 768) {
      template = "<div class='popover-flex'>" + template + "</div>";
  }

  elt.popover({
      // temporary patch for handling popover placement of `viewport_center`
      placement,
      fix_positions: true,
      template,
      title: "",
      content: generate_mention_picker_content(id),
      html: true,
      trigger: "manual",
  });
  elt.popover("show");

  const popover = elt.data("popover").$tip;
  popover.find(".mention-popover-filter").trigger("focus");
  current_message_mention_popover_elem = elt;

  mention_catalog_last_coordinates = {
      section: 0,
      index: 0,
  };

  register_popover_events();
}

export function toggle_mention_popover(element, id) {
  const last_popover_elem = current_message_mention_popover_elem;
  popovers.hide_all();
  if (last_popover_elem !== undefined && last_popover_elem.get()[0] === element) {
      // We want it to be the case that a user can dismiss a popover
      // by clicking on the same element that caused the popover.
      return;
  }

  const compose_click_target = compose_ui.get_compose_click_target(element);
  if ($(compose_click_target).parents(".message_edit_form").length === 1) {
      // Store message id in global variable edit_message_id so that
      // its value can be further used to correctly find the message textarea element.
      edit_message_id = rows.get_message_id(compose_click_target);
  } else {
      edit_message_id = null;
  }

  $(element).closest(".message_row").toggleClass("has_popover has_mention_popover");
  const elt = $(element);
  if (id !== undefined) {
      message_lists.current.select_id(id);
  }

  if (user_status_ui.user_status_picker_open()) {
      build_mention_popover(elt, id, true);
  } else if (elt.data("popover") === undefined) {
      // Keep the element over which the popover is based off visible.
      elt.addClass("reaction_button_visible");
      build_mention_popover(elt, id);
  }
}