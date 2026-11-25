<?php
/**
 * Plugin Name: Central de Comunicações BVA
 * Description: Dashboard autenticado para constrangimentos hospitalares, prontidão especial e avisos operacionais.
 * Version: 0.2.1
 * Requires at least: 6.2
 * Requires PHP: 8.0
 * Author: Bombeiros Voluntários da Amadora
 * License: GPL-2.0-or-later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: bva-central-comunicacoes
 */

if (!defined('ABSPATH')) { exit; }

final class BVA_Central_Comunicacoes {
    const VERSION = '0.2.1';
    const CAPABILITY = 'edit_bva_central';
    const REST_NAMESPACE = 'bva-central/v1';

    public static function init() {
        add_shortcode('bva_central', array(__CLASS__, 'shortcode'));
        add_action('rest_api_init', array(__CLASS__, 'register_routes'));
        add_action('admin_menu', array(__CLASS__, 'access_menu'));
    }

    public static function activate() {
        global $wpdb;
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        $table = self::table_name();
        $charset = $wpdb->get_charset_collate();
        $sql = "CREATE TABLE {$table} (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            record_type varchar(24) NOT NULL,
            record_data longtext NOT NULL,
            starts_at datetime NULL,
            ends_at datetime NULL,
            modified_at datetime NOT NULL,
            PRIMARY KEY  (id),
            KEY type_dates (record_type, starts_at, ends_at)
        ) {$charset};";
        dbDelta($sql);

        $admin = get_role('administrator');
        if ($admin) { $admin->add_cap(self::CAPABILITY); }
        if (!get_role('bva_central_editor')) {
            add_role('bva_central_editor', 'Editor da Central BVA', array(
                'read' => true,
                self::CAPABILITY => true,
            ));
        }
        add_option('bva_central_hospitals', array(
            'Hospital Amadora-Sintra (HFF)',
            'Hospital de São José',
            'Hospital de Santa Maria',
            'Hospital de São Francisco Xavier',
            'Hospital de Loures',
        ));
        add_option('bva_central_services', array(
            'Urgência Geral',
            'Urgência de Obstetrícia / Bloco de Partos',
            'Urgência Pediátrica',
            'Urgência de Ginecologia',
            'Urgência de Oftalmologia',
            'Urgência de Ortopedia',
            'Serviço de Imagiologia',
            'Pediatria',
        ));
    }

    private static function table_name() {
        global $wpdb;
        return $wpdb->prefix . 'bva_central_records';
    }

    public static function can_edit() {
        return current_user_can(self::CAPABILITY) || current_user_can('manage_options');
    }

    public static function shortcode() {
        if (!is_user_logged_in()) {
            $login = wp_login_form(array(
                'echo' => false,
                'redirect' => get_permalink(),
                'form_id' => 'bva-central-login',
            ));
            return '<section class="bva-central-login"><h2>Central de Comunicações</h2><p>Inicia sessão com a tua conta WordPress para consultar o dashboard.</p>' . $login . '</section>';
        }

        wp_enqueue_style('bva-central-app', plugin_dir_url(__FILE__) . 'assets/app.css', array(), self::VERSION);
        wp_enqueue_script('bva-central-app', plugin_dir_url(__FILE__) . 'assets/app.js', array(), self::VERSION, true);
        wp_localize_script('bva-central-app', 'BVACentralConfig', array(
            'restRoot' => esc_url_raw(rest_url(self::REST_NAMESPACE . '/')),
            'nonce' => wp_create_nonce('wp_rest'),
            'canEdit' => self::can_edit(),
            'version' => self::VERSION,
        ));

        ob_start();
        include plugin_dir_path(__FILE__) . 'templates/dashboard.php';
        return ob_get_clean();
    }

    public static function register_routes() {
        register_rest_route(self::REST_NAMESPACE, '/records', array(
            array(
                'methods' => WP_REST_Server::READABLE,
                'callback' => array(__CLASS__, 'get_records'),
                'permission_callback' => array(__CLASS__, 'can_read'),
            ),
            array(
                'methods' => WP_REST_Server::CREATABLE,
                'callback' => array(__CLASS__, 'create_record'),
                'permission_callback' => array(__CLASS__, 'can_edit_permission'),
            ),
        ));
        register_rest_route(self::REST_NAMESPACE, '/records/(?P<id>\d+)', array(
            array(
                'methods' => WP_REST_Server::EDITABLE,
                'callback' => array(__CLASS__, 'update_record'),
                'permission_callback' => array(__CLASS__, 'can_edit_permission'),
            ),
            array(
                'methods' => WP_REST_Server::DELETABLE,
                'callback' => array(__CLASS__, 'delete_record'),
                'permission_callback' => array(__CLASS__, 'can_edit_permission'),
            ),
        ));
        register_rest_route(self::REST_NAMESPACE, '/catalog', array(
            array(
                'methods' => WP_REST_Server::READABLE,
                'callback' => array(__CLASS__, 'get_catalog'),
                'permission_callback' => array(__CLASS__, 'can_read'),
            ),
            array(
                'methods' => WP_REST_Server::CREATABLE,
                'callback' => array(__CLASS__, 'add_catalog_item'),
                'permission_callback' => array(__CLASS__, 'can_edit_permission'),
            ),
        ));
        register_rest_route(self::REST_NAMESPACE, '/catalog/(?P<type>hospital|service)', array(
            'methods' => WP_REST_Server::DELETABLE,
            'callback' => array(__CLASS__, 'delete_catalog_item'),
            'permission_callback' => array(__CLASS__, 'can_edit_permission'),
        ));
    }

    public static function can_read() {
        return is_user_logged_in() && current_user_can('read');
    }

    public static function can_edit_permission() {
        return self::can_edit();
    }

    public static function get_records() {
        global $wpdb;
        $items = $wpdb->get_results($wpdb->prepare('SELECT id, record_type, record_data, modified_at FROM %i ORDER BY starts_at ASC, id ASC', self::table_name()), ARRAY_A);
        $records = array('constraints' => array(), 'readiness' => array(), 'notices' => array(), 'updatedAt' => null);
        $latest_timestamp = 0;
        foreach ($items as $item) {
            $bucket = $item['record_type'];
            if (!isset($records[$bucket])) { continue; }
            $row = json_decode($item['record_data'], true);
            if (!is_array($row)) { continue; }
            $row['id'] = (string) $item['id'];
            $records[$bucket][] = $row;
            $modified_timestamp = strtotime($item['modified_at'] . ' UTC');
            if ($modified_timestamp > $latest_timestamp) {
                $latest_timestamp = $modified_timestamp;
                $records['updatedAt'] = get_date_from_gmt($item['modified_at'], DATE_ATOM);
            }
        }
        if (!$records['updatedAt']) { $records['updatedAt'] = current_time(DATE_ATOM); }
        return rest_ensure_response($records);
    }

    private static function clean_record($type, $row) {
        if (!is_array($row)) { return new WP_Error('invalid_record', 'Registo inválido.', array('status' => 400)); }
        $clean = array();
        if ($type === 'constraint') {
            foreach (array('hospital', 'service', 'detail') as $key) { $clean[$key] = sanitize_text_field($row[$key] ?? ''); }
            $clean['start'] = sanitize_text_field($row['start'] ?? '');
            $clean['end'] = sanitize_text_field($row['end'] ?? '');
            if (!$clean['hospital'] || !$clean['service']) { return new WP_Error('required_fields', 'Indica o hospital e o serviço.', array('status' => 400)); }
        } elseif ($type === 'readiness') {
            $clean['level'] = sanitize_key($row['level'] ?? '');
            $clean['region'] = sanitize_text_field($row['region'] ?? '');
            $clean['detail'] = sanitize_text_field($row['detail'] ?? '');
            $clean['start'] = sanitize_text_field($row['start'] ?? '');
            $clean['end'] = sanitize_text_field($row['end'] ?? '');
            if (!in_array($clean['level'], array('normal', 'i', 'ii', 'iii', 'iv'), true) || !$clean['region']) {
                return new WP_Error('invalid_readiness', 'Seleciona um nível e indica a sub-região.', array('status' => 400));
            }
        } elseif ($type === 'notice') {
            $clean['title'] = sanitize_text_field($row['title'] ?? '');
            $clean['text'] = sanitize_textarea_field($row['text'] ?? '');
            if (!$clean['title'] || !$clean['text']) { return new WP_Error('required_fields', 'Indica o título e a informação do aviso.', array('status' => 400)); }
            return $clean;
        } else {
            return new WP_Error('invalid_type', 'Tipo de registo inválido.', array('status' => 400));
        }

        $start_ts = strtotime($clean['start']);
        $end_ts = strtotime($clean['end']);
        if (!$start_ts || !$end_ts || $end_ts <= $start_ts) {
            return new WP_Error('invalid_dates', 'As datas são inválidas ou a hora de fim não é posterior ao início.', array('status' => 400));
        }
        $clean['start'] = gmdate('c', $start_ts);
        $clean['end'] = gmdate('c', $end_ts);
        return $clean;
    }

    private static function insert_values($type, $clean) {
        $start = isset($clean['start']) ? gmdate('Y-m-d H:i:s', strtotime($clean['start'])) : null;
        $end = isset($clean['end']) ? gmdate('Y-m-d H:i:s', strtotime($clean['end'])) : null;
        return array(
            'record_type' => $type,
            'record_data' => wp_json_encode($clean),
            'starts_at' => $start,
            'ends_at' => $end,
            'modified_at' => current_time('mysql', true),
        );
    }

    public static function create_record($request) {
        global $wpdb;
        $params = $request->get_json_params();
        $type = sanitize_key($params['type'] ?? '');
        $clean = self::clean_record($type, $params['row'] ?? null);
        if (is_wp_error($clean)) { return $clean; }
        $ok = $wpdb->insert(self::table_name(), self::insert_values($type, $clean));
        if (!$ok) { return new WP_Error('save_failed', 'Não foi possível guardar o registo.', array('status' => 500)); }
        $clean['id'] = (string) $wpdb->insert_id;
        return new WP_REST_Response($clean, 201);
    }

    public static function update_record($request) {
        global $wpdb;
        $id = absint($request['id']);
        $params = $request->get_json_params();
        $type = sanitize_key($params['type'] ?? '');
        $clean = self::clean_record($type, $params['row'] ?? null);
        if (is_wp_error($clean)) { return $clean; }
        $exists = $wpdb->get_var($wpdb->prepare('SELECT id FROM %i WHERE id = %d', self::table_name(), $id));
        if (!$exists) { return new WP_Error('not_found', 'Registo não encontrado.', array('status' => 404)); }
        $ok = $wpdb->update(self::table_name(), self::insert_values($type, $clean), array('id' => $id));
        if ($ok === false) { return new WP_Error('save_failed', 'Não foi possível atualizar o registo.', array('status' => 500)); }
        $clean['id'] = (string) $id;
        return rest_ensure_response($clean);
    }

    public static function delete_record($request) {
        global $wpdb;
        $id = absint($request['id']);
        $deleted = $wpdb->delete(self::table_name(), array('id' => $id), array('%d'));
        if (!$deleted) { return new WP_Error('not_found', 'Registo não encontrado.', array('status' => 404)); }
        return new WP_REST_Response(array('deleted' => true), 200);
    }

    private static function catalog_option($type) {
        return $type === 'hospital' ? 'bva_central_hospitals' : 'bva_central_services';
    }

    public static function get_catalog() {
        return rest_ensure_response(array(
            'hospitals' => array_values((array) get_option('bva_central_hospitals', array())),
            'services' => array_values((array) get_option('bva_central_services', array())),
        ));
    }

    public static function add_catalog_item($request) {
        $params = $request->get_json_params();
        $type = sanitize_key($params['type'] ?? '');
        $value = sanitize_text_field($params['value'] ?? '');
        if (!in_array($type, array('hospital', 'service'), true) || !$value) {
            return new WP_Error('invalid_catalog_item', 'Indica um nome válido.', array('status' => 400));
        }
        $option = self::catalog_option($type);
        $items = array_values(array_map('sanitize_text_field', (array) get_option($option, array())));
        foreach ($items as $item) {
            if (strtolower(remove_accents($item)) === strtolower(remove_accents($value))) {
                return new WP_Error('duplicate_catalog_item', 'Este nome já existe na lista.', array('status' => 409));
            }
        }
        $items[] = $value;
        update_option($option, $items, false);
        return rest_ensure_response(array('hospitals' => array_values((array) get_option('bva_central_hospitals', array())), 'services' => array_values((array) get_option('bva_central_services', array()))));
    }

    public static function delete_catalog_item($request) {
        global $wpdb;
        $type = sanitize_key($request['type']);
        $params = $request->get_json_params();
        $value = sanitize_text_field($params['value'] ?? '');
        $option = self::catalog_option($type);
        $items = array_values((array) get_option($option, array()));
        if (!in_array($value, $items, true)) { return new WP_Error('not_found', 'Item não encontrado na lista.', array('status' => 404)); }

        $rows = $wpdb->get_col($wpdb->prepare('SELECT record_data FROM %i WHERE record_type = %s', self::table_name(), 'constraint'));
        $field = $type === 'hospital' ? 'hospital' : 'service';
        foreach ($rows as $json) {
            $record = json_decode($json, true);
            if (isset($record[$field]) && $record[$field] === $value) {
                return new WP_Error('catalog_item_in_use', 'Este item está associado a um constrangimento. Altera ou apaga primeiro esse registo.', array('status' => 409));
            }
        }

        $items = array_values(array_filter($items, static function ($item) use ($value) { return $item !== $value; }));
        update_option($option, $items, false);
        return rest_ensure_response(array('hospitals' => array_values((array) get_option('bva_central_hospitals', array())), 'services' => array_values((array) get_option('bva_central_services', array()))));
    }

    public static function access_menu() {
        add_users_page('Acesso à Central BVA', 'Acesso à Central BVA', 'list_users', 'bva-central-access', array(__CLASS__, 'access_page'));
    }

    public static function access_page() {
        if (!current_user_can('list_users')) { return; }
        if (isset($_POST['bva_central_save_access'], $_POST['_wpnonce']) && wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['_wpnonce'])), 'bva_central_access')) {
            $allowed = isset($_POST['bva_central_editors']) ? array_map('absint', (array) wp_unslash($_POST['bva_central_editors'])) : array();
            foreach (get_users() as $user) {
                if (user_can($user, 'manage_options')) { continue; }
                if (in_array((int) $user->ID, $allowed, true)) { $user->add_cap(self::CAPABILITY); }
                else { $user->remove_cap(self::CAPABILITY); }
            }
            echo '<div class="notice notice-success is-dismissible"><p>Permissões atualizadas.</p></div>';
        }
        $users = get_users(array('orderby' => 'display_name', 'order' => 'ASC'));
        echo '<div class="wrap"><h1>Acesso à Central BVA</h1><p>Todos os utilizadores autenticados podem consultar a página com o shortcode <code>[bva_central]</code>. Assinala os utilizadores que também podem editar os registos.</p><form method="post">';
        wp_nonce_field('bva_central_access');
        echo '<table class="widefat striped"><thead><tr><th>Utilizador</th><th>Email</th><th>Permissão de edição</th></tr></thead><tbody>';
        foreach ($users as $user) {
            if (user_can($user, 'manage_options')) { continue; }
            echo '<tr><td>' . esc_html($user->display_name) . '</td><td>' . esc_html($user->user_email) . '</td><td><label><input type="checkbox" name="bva_central_editors[]" value="' . esc_attr($user->ID) . '"' . checked(user_can($user, self::CAPABILITY), true, false) . '> Pode editar</label></td></tr>';
        }
        echo '</tbody></table><p class="description">Os administradores do WordPress podem sempre editar. Esta seleção define os restantes editores.</p><p><button class="button button-primary" type="submit" name="bva_central_save_access" value="1">Guardar permissões de edição</button></p></form></div>';
    }
}

register_activation_hook(__FILE__, array('BVA_Central_Comunicacoes', 'activate'));
BVA_Central_Comunicacoes::init();
